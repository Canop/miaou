// postgresql persistence
// Usage :
//   
//  db.on(req.user)                             // returns a promise bound to the connection taken from the pool
//	.then(db.updateUser)                        // quering functions are available on the db object and use the connection (context of the call)
//	.then(function(user){                       // when you can't use the simple form
//  	if (!user.bot) return this.ping(uid)    // `this` is the connection
//	}).finally(db.off);                         // releases the connection which is returned to the pool
// 

var pg = require('pg').native,
	Promise = require("bluebird"),
	pool,
	conString;

Promise.longStackTraces(); // this will be removed in production in the future

// The connection object which is used for all postgress accesses from other files
function Con(){}
var proto = Con.prototype;

var NoRowError = exports.NoRowError = function(){};
NoRowError.prototype = Object.create(Error.prototype);

//////////////////////////////////////////////// #users

// fetches a user found by the OAuth profile, creates it if it doesn't exist
// Private fields are included in the returned object
proto.getCompleteUserFromOAuthProfile = function(profile){
	//~ console.dir(profile);
	var oauthid = profile.id || profile.user_id, // id for google, user_id for stackexchange
		displayName = profile.displayName || profile.display_name, // displayName for google, display_name for stackexchange
		provider = profile.provider;
	if (!oauthid) throw new Error('no id found in OAuth profile');
	var con = this,
		resolver = Promise.defer(),
		email = null, returnedCols = 'id, name, oauthdisplayname, email';
	if (profile.emails && profile.emails.length) email = profile.emails[0].value; // google
	con.client.query('select '+returnedCols+' from player where oauthprovider=$1 and oauthid=$2', [provider, oauthid], function(err, result){
		if (err) {
			resolver.reject(err);
		} else if (result.rows.length) {
			resolver.resolve(result.rows[0]);
		} else {
			resolver.resolve(con.queryRow(
				'insert into player (oauthid, oauthprovider, email, oauthdisplayname) values ($1, $2, $3, $4) returning '+returnedCols,
				[oauthid, provider, email, displayName]
			));
		}
	});
	return resolver.promise.bind(this);
}

// returns an existing user found by his id
// Only public fields are returned
// Private fields are included in the returned object
proto.getUserById = function(id){
	return this.queryRow('select id, name, oauthdisplayname, email from player where id=$1', [id]);
}

// right now it only updates the name, I'll enrich it if the need arises
proto.updateUser = function(user){
	return this.queryRow('update player set name=$1 where id=$2', [user.name, user.id]);
}

proto.listRecentUsers = function(roomId, N){
	return this.queryRows(
		"select message.author as id, min(player.name) as name, max(message.created) as mc from message join player on player.id=message.author"+
		" where message.room=$1 group by message.author order by mc desc limit $2", [roomId, N]
	);
}

///////////////////////////////////////////// #rooms

proto.storeRoom = function(r, author) {
	var now = ~~(Date.now()/1000);
	if (r.id) {
		return this.queryRow(
			"update room set name=$1, private=$2, description=$3 where id=$4"+
			" and exists(select auth from room_auth where player=$5 and room=$4 and auth>='admin')",
			[r.name, r.private, r.description||'', r.id, author.id]
		);
	} else {
		return this.queryRow(
			'insert into room (name, private, description) values ($1, $2, $3) returning id',
			[r.name, r.private, r.description||'']
		).then(function(row){
			r.id = result.rows[0].id;
			return this.queryRow(
				'insert into room_auth (room, player, auth, granted) values ($1, $2, $3, $4)',
				[r.id, author.id, 'own', now]
			);
		});		
	}
}

// returns an existing room found by its id
proto.fetchRoom = function(id){
	return this.queryRow('select id, name, description, private from room where id=$1', [id]);
}

// returns an existing room found by its id and the user's auth level
proto.fetchRoomAndUserAuth = function(roomId, userId){
	return this.queryRow('select id, name, description, private, auth from room left join room_auth a on a.room=room.id and a.player=$1 where room.id=$2', [userId, roomId]);
}

// gets an array of all public rooms
proto.listPublicRooms = function(){
	return this.queryRows('select id, name, description from room where private is not true', []);
}

// lists the rooms a user can access, either public or whose access was explicitely granted
proto.listAccessibleRooms = function(userId){
	return this.queryRows(
		"select id, name, description, private, auth from room r left join room_auth a on a.room=r.id and a.player=$1"+
		" where private is false or auth is not null order by auth desc nulls last, name", [userId]
	);
}

///////////////////////////////////////////// #auths

// lists the authorizations a user has
proto.listUserAuths = function(userId){
	return this.queryRows("select id, name, description, auth from room r, room_auth a where a.room=r.id and a.player=$1", [userId]);
}

// lists the authorizations of the room
proto.listRoomAuths = function(roomId){
	return this.queryRows("select id, name, auth, player, granter, granted from player p, room_auth a where a.player=p.id and a.room=$1 order by auth desc, name", [roomId]);
}

proto.insertAccessRequest = function(roomId, userId){
	return this.queryRow('delete from access_request where room=$1 and player=$2', [roomId, userId])
	.then(this.queryRow(
		'insert into access_request (room, player, requested) values ($1, $2, $3) returning *',
		[roomId, userId, ~~(Date.now()/1000)]
	));
}

// userId : optionnal
proto.listOpenAccessRequests = function(roomId, userId){
	var sql = "select player,name,requested from player p,access_request r where r.player=p.id and room=$1", args = [roomId];		
	if (userId) {
		sql += " and player=?";
		args.push(userId);
	}
	return this.queryRows(sql, args);
}

// do actions on user rights
// userId : id of the user doing the action
proto.changeRights = function(actions, userId, room){
	var con = this, now= ~~(Date.now()/1000);
	return Promise.map(actions, function(a){
		var sql, args;
		switch (a.cmd) {
		case "insert_auth": // we can assume there's no existing auth
			sql = "insert into room_auth (room, player, auth, granter, granted) values ($1, $2, $3, $4, $5)";
			args = [room.id, a.user, a.auth, userId, now];
			break;
		case "delete_ar":
			sql = "delete from access_request where room=$1 and player=$2";
			args = [room.id, a.user];
			break;
		case "update_auth":
			// the exists part is used to check the user doing the change has at least as much auth than the modified user
			sql = "update room_auth ma set auth=$1 where ma.player=$2 and ma.room=$3 and exists (select * from room_auth ua where ua.player=$4 and ua.room=$5 and ua.auth>=ma.auth)";
			args = [a.auth, a.user, room.id, userId, room.id];
			break;
		case "delete_auth":
			// the exists part is used to check the user doing the change has at least as much auth than the modified user
			sql = "delete from room_auth ma where ma.player=$1 and ma.room=$2 and exists (select * from room_auth ua where ua.player=$3 and ua.room=$4 and ua.auth>=ma.auth)";
			args = [a.user, room.id, userId, room.id];
			break;
		}
		return con.queryRow(sql, args);
	});	
}

proto.checkAuthLevel = function(roomId, userId, minimalLevel){
	return this.queryRow(
		"select auth from room_auth where player=$1 and room=$2 and auth>=$3",
		[userId, roomId, minimalLevel]
	).catch(NoRowError, function(){
		return false;
	}).then(function(row){
		return row.auth;
	});
}

//////////////////////////////////////////////// #messages

// returns a query object usable for streaming messages for a specific user (including his votes)
// see calls of this function to see how the additional arguments are used 
proto.queryMessages = function(roomId, userId, N, chronoOrder){
	var args = [roomId, userId, N],
		sql = 'select message.id, author, player.name as authorname, content, message.created as created, message.changed, pin, star, up, down, vote, score from message'+
		' left join message_vote on message.id=message and message_vote.player=$2'+
		' inner join player on author=player.id where room=$1';
	for (var i=0, j=4; arguments[j+1]; i++) {
		sql += ' and message.id'+arguments[j]+'$'+(j++-i);
		args.push(arguments[j++]);
	}
	sql += ' order by message.id '+ ( chronoOrder ? 'asc' : 'desc') + ' limit $3';
	return this.client.query(sql, args);
}

// returns a query with the most recent messages of the room
// If before is provided, then we look for messages older than this (not included)
// If until is also provided, we don't want to look farther
proto.queryMessagesBefore = function(roomId, userId, N, before, until){
	return this.queryMessages(roomId, userId, N, false, '<', before, '>=', until);
}

// returns a query with the message messageId (if found)
//  and the following ones up to N ones and up to the one with id before
// If before is also provided, we don't want to look farther
proto.queryMessagesAfter = function(roomId, userId, N, messageId, before){
	return this.queryMessages(roomId, userId, N, true, '>=', messageId, '<=', before);	
}

Con.prototype.getNotableMessages = function(roomId, createdAfter){
	return this.queryRows(
		'select message.id, author, player.name as authorname, content, created, pin, star, up, down, score from message'+
		' inner join player on author=player.id where room=$1 and created>$2 and score>4'+
		' order by score desc limit 12', [roomId, createdAfter]
	);
}

// fetches one message. Votes of the passed user are included
proto.getMessage = function(messageId, userId){
	return this.queryRow(
		'select message.id, author, player.name as authorname, content, message.created as created, message.changed, pin, star, up, down, vote, score from message'+
		' left join message_vote on message.id=message and message_vote.player=$2'+
		' inner join player on author=player.id'+
		' where message.id=$1', [messageId, userId]
	);
}

// if id is set, updates the message if the author & room matches
// else stores a message and sets its id
proto.storeMessage = function(m){
	if (m.id && m.changed) {
		// TODO : check the message isn't too old for edition
		return this.queryRow(
			'update message set content=$1, changed=$2 where id=$3 and room=$4 and author=$5 returning *',
			[m.content, m.changed, m.id, m.room, m.author]
		);
	} else {
		return this.queryRow(
			'insert into message (room, author, content, created) values ($1, $2, $3, $4) returning id',
			[m.room, m.author, m.content, m.created]
		).then(function(row){
			m.id = row.id;
			return m;
		});
	}
}

proto.updateGetMessage = function(messageId, expr, userId){
	return this.queryRow("update message set "+expr+" where id=$1", [messageId])
	.then(function(){
		return this.getMessage(messageId, userId);
	});
}

//////////////////////////////////////////////// #pings

// pings must be a sanitized array of usernames
proto.storePings = function(roomId, users, messageId){
	var now = ~~(Date.now()/1000);
	return this.queryRows(
		"insert into ping (room, player, message, created) select "
		+ roomId + ", id, " + messageId + ", " + now + " from player where name in (" + users.map(function(n){ return "'"+n+"'" }).join(',') + ")"
	);
}

proto.deletePings = function(roomId, userId){
	return this.queryRows("delete from ping where room=$1 and player=$2", [roomId, userId]);
}

proto.fetchUserPings = function(userId) {
	return this.queryRows("select player, room, name, message from ping, room where player=$1 and room.id=ping.room", [userId]);
}

// returns the id and name of the rooms where the user has been pinged since a certain time (seconds since epoch)
proto.fetchUserPingRooms = function(userId, after) {
	return this.queryRows("select room, max(name) as roomname, max(created) as last from ping, room where player=$1 and room.id=ping.room and created>$2 group by room", [userId, after]);
}

//////////////////////////////////////////////// #votes

proto.addVote = function(roomId, userId, messageId, level) {
	var sql, args;
	switch (level) {
	case 'pin': case 'star': case 'up': case 'down':
		sql = "insert into message_vote (message, player, vote) select $1, $2, $3";
		sql += " where exists(select * from message where id=$1 and room=$4)"; // to avoid users cheating by voting on messages they're not allowed to
		args = [messageId, userId, level, roomId];
		break;
	default:
		throw new Error('Unknown vote level');
	}
	console.log('in addVote');
	return this.queryRow(sql, args)
	.then(function(){
		return this.updateGetMessage(messageId, level+"="+level+"+1", userId);
	});
}
proto.removeVote = function(roomId, userId, messageId, level) {
	return this.queryRow("delete from message_vote where message=$1 and player=$2 and vote=$3", [messageId, userId, level])
	.then(function(){
		return this.updateGetMessage(messageId, level+"="+level+"-1", userId);
	});
}

//////////////////////////////////////////////// #global API

function logQuery(sql, args) { // used in debug
	console.log(sql.replace(/\$(\d+)/g, function(_,i){ var s=args[i-1]; return typeof s==="string" ? "'"+s+"'" : s }));
}

// must be called before any call to connect
// todo return a promise
exports.init = function(dbConfig, cb){
	conString = dbConfig.url;
	pg.defaults.parseInt8 = true;
	pg.connect(conString, function(err, client, done){
		if (err) {
			console.log('Connection to PostgreSQL database failed');
			return;
		}
		done();
		console.log('Connection to PostgreSQL database successful');
		pool = pg.pools.all[JSON.stringify(conString)];
		cb();
	})
}

// returns a promise bound to a connection, available to issue queries
//  The connection must be released using off
exports.on = function(val){
	var con = new Con(), resolver = Promise.defer();
	pool.connect(function(err, client, done){
		if (err) {
			resolver.reject(err);
		} else {
			con.client = client;
			con.done = done;
			resolver.resolve(val);
		}
	});
	return resolver.promise.bind(con);
}

// releases the connection which returns to the pool
// It's ok to call this function more than once
proto.off = function(){
	if (this instanceof Con) {
		if (this.done) {
			this.done();
			this.done = null;
		} else {
			 console.log('connection already released'); // no worry
		 }
	} else {
		console.log('not a connection!'); // if this happens, there's probably a leaked connection
	}
}

// throws a NoRowError if no row was found (select) or affected (insert, select)
proto.queryRow = function(sql, args){
	var resolver = Promise.defer();
	this.client.query(sql, args, function(err, res){
		//~ logQuery(sql, args);
		if (err) {
			resolver.reject(err);
		} else if (res.rows.length || res.rowCount) {
			resolver.resolve(res.rows[0]);
		} else {
			resolver.reject(new NoRowError());
		}
	});
	return resolver.promise.bind(this);
}

proto.queryRows = function(sql, args){
	var resolver = Promise.defer();
	this.client.query(sql, args, function(err, res){
		//~ logQuery(sql, args);
		if (err) resolver.reject(err);
		else resolver.resolve(res.rows);
	});
	return resolver.promise.bind(this);
}

for (var name in proto) {
	if (proto.hasOwnProperty(name) && typeof proto[name] === "function") {
		exports[name] = proto[name];
	}
}
