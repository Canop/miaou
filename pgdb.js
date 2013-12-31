// postgresql persistence

var pg = require('pg').native,
	pool,
	conString;

function logQuery(sql, args) { // used in debug
	console.log(sql.replace(/\$(\d+)/g, function(_,i){ var s=args[i-1]; return typeof s==="string" ? "'"+s+"'" : s }));
}

function Con(client, done) {
	this.client = client;
	this.ok = done.bind(this);
}
Con.prototype.nok = function(cb, err){
	this.ok();
	cb(err);
}
// returns an error if no row was found (select) or affected (insert, select)
Con.prototype.queryRow = function(sql, args, cb){
	var con = this;
	con.client.query(sql, args, function(err, res){
		if (err) con.nok(cb, err);
		else if (res.rows.length || res.rowCount) cb(null, res.rows[0]);
		else con.nok(cb, new Error('no row'));
	});
}
Con.prototype.queryRows = function(sql, args, cb){
	var con = this;
	con.client.query(sql, args, function(err, res){
		if (err) con.nok(cb, err);
		else cb(null, res.rows)
	});
}

// returns a user found by the Google OAuth profile, creates it if it doesn't exist
// Private fields are included in the returned object
Con.prototype.fetchCompleteUserFromOAuthProfile = function(profile, cb){
	var con = this, email = profile.emails[0].value, returnedCols = 'id, name, oauthdisplayname, email';
	con.client.query('select '+returnedCols+' from player where email=$1', [email], function(err, result){
		if (err) return con.nok(cb, err);
		if (result.rows.length) return cb(null, result.rows[0]);
		con.queryRow(
			'insert into player (oauthid, oauthprovider, email, oauthdisplayname) values ($1, $2, $3, $4) returning '+returnedCols,
			[profile.id, profile.provider, email, profile.displayName], cb
		);
	});
}

// returns an existing user found by his id
// Only public fields are returned
// Private fields are included in the returned object
Con.prototype.fetchUserById = function(id, cb){
	this.queryRow('select id, name, oauthdisplayname, email from player where id=$1', [id], cb);
}

// right now it only updates the name, I'll enrich it if the need arises
Con.prototype.updateUser = function(user, cb){
	this.queryRow('update player set name=$1 where id=$2', [user.name, user.id], cb);
}

// returns an existing room found by its id
Con.prototype.fetchRoom = function(id, cb){
	this.queryRow('select id, name, description, private from room where id=$1', [id], cb);
}

// returns an existing room found by its id and the user's auth level
Con.prototype.fetchRoomAndUserAuth = function(roomId, userId, cb){
	this.queryRow('select id, name, description, private, auth from room left join room_auth a on a.room=room.id and a.player=$1 where room.id=$2', [userId, roomId], cb);
}

// gives to cb an array of all public rooms
Con.prototype.listPublicRooms = function(cb){
	this.queryRows('select id, name, description from room where private is not true', [], cb);
}
// lists the authorizations a user has
Con.prototype.listUserAuths = function(userId, cb){
	this.queryRows("select id, name, description, auth from room r, room_auth a where a.room=r.id and a.player=$1", [userId], cb);
}
// lists the authorizations of the room
Con.prototype.listRoomAuths = function(roomId, cb){
	this.queryRows("select id, name, auth, player, granter, granted from player p, room_auth a where a.player=p.id and a.room=$1 order by auth desc, name", [roomId], cb);
}

// lists the 
Con.prototype.listAccessibleRooms = function(userId, cb){
	this.queryRows(
		"select id, name, description, private, auth from room r left join room_auth a on a.room=r.id and a.player=$1"+
		" where private is false or auth is not null order by auth desc nulls last, name", [userId], cb
	);
}

Con.prototype.insertAccessRequest = function(roomId, userId, cb){
	var con = this;
	con.client.query('delete from access_request where room=$1 and player=$2', [roomId, userId], function(err, result){
		if (err) return con.nok(cb, err);
		con.queryRow(
			'insert into access_request (room, player, requested) values ($1, $2, $3) returning *',
			[roomId, userId, ~~(Date.now()/1000)], cb
		);
	});
}

// userId : optionnal
Con.prototype.listOpenAccessRequests = function(roomId, userId, cb){
	var sql = "select player,name,requested from player p,access_request r where r.player=p.id and room=$1", args = [roomId];		
	if (typeof userId === "function") {
		cb = userId;
	} else {
		sql += " and player=?";
		args.push(userId);
	}
	this.queryRows(sql, args, cb);	
}

// returns a query object usable for streaming messages for a specific user (including his votes)
// see calls of this function to see how the additional arguments are used 
Con.prototype.queryMessages = function(roomId, userId, N, chronoOrder){
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
Con.prototype.queryMessagesBefore = function(roomId, userId, N, before, until){
	return this.queryMessages(roomId, userId, N, false, '<', before, '>=', until);
}
// returns a query with the message messageId (if found)
//  and the following ones up to N ones and up to the one with id before
// If before is also provided, we don't want to look farther
Con.prototype.queryMessagesAfter = function(roomId, userId, N, messageId, before){
	return this.queryMessages(roomId, userId, N, true, '>=', messageId, '<=', before);	
}

Con.prototype.getNotableMessages = function(roomId, createdAfter, cb){
	this.queryRows(
		'select message.id, author, player.name as authorname, content, created, pin, star, up, down, score from message'+
		' inner join player on author=player.id where room=$1 and created>$2 and score>4'+
		' order by score desc limit 12', [roomId, createdAfter], cb
	);
}

// fetches one message. Votes of the passed user are included
Con.prototype.getMessage = function(messageId, userId, cb){
	this.queryRow(
		'select message.id, author, player.name as authorname, content, message.created as created, message.changed, pin, star, up, down, vote, score from message'+
		' left join message_vote on message.id=message and message_vote.player=$2'+
		' inner join player on author=player.id'+
		' where message.id=$1', [messageId, userId], cb
	);
}

// do actions on user rights
// userId : id of the user doing the action
Con.prototype.changeRights = function(actions, userId, room, cb){
	var con = this, now= ~~(Date.now()/1000);
	if (!actions.length) return cb();
	(function doOne(err){
		if (err) return cb(err);
		var a = actions.pop(), sql, args;
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
		con.client.query(sql, args, actions.length ? doOne : cb);
	})();
}

// if id is set, updates the message if the author & room matches
// else stores a message and sets its id
Con.prototype.storeMessage = function(m, cb){
	var con = this;
	if (m.id && m.changed) {
		// TODO : check the message isn't too old for edition
		con.client.query(
			'update message set content=$1, changed=$2 where id=$3 and room=$4 and author=$5 returning created',
			[m.content, m.changed, m.id, m.room, m.author],
			function(err, result)
		{
			if (err) return con.nok(cb, err);
			m.created = result.rows[0].created;
			cb(null, m)
		});
	} else {
		con.client.query(
			'insert into message (room, author, content, created) values ($1, $2, $3, $4) returning id',
			[m.room, m.author, m.content, m.created],
			function(err, result)
		{
			if (err) return con.nok(cb, err);
			m.id = result.rows[0].id;
			cb(null, m);
		});
	}
}

Con.prototype.checkAuthLevel = function(roomId, userId, minimalLevel, cb){
	var con = this;
	con.client.query(
		"select auth from room_auth where player=$1 and room=$2 and auth>=$3",
		[userId, roomId, minimalLevel],
		function(err, result)
	{
		if (err) return con.nok(cb, err);
		if (result.rows.length) cb(null, result.rows[0].auth);
		else cb(null, false);
	});
}

// pings must be a sanitized array of usernames
Con.prototype.storePings = function(roomId, users, messageId, cb){
	var con = this, now = ~~(Date.now()/1000),
		sql = "insert into ping (room, player, message, created) select "
		+ roomId + ", id, " + messageId + ", " + now + " from player where name in (" + users.map(function(n){ return "'"+n+"'" }).join(',') + ")";
	con.client.query(sql, function(err){
		if (err) return con.nok(cb, err);
		cb(null);
	});
}

Con.prototype.deletePings = function(roomId, userId, cb){
	this.queryRows("delete from ping where room=$1 and player=$2", [roomId, userId], cb);
}

Con.prototype.fetchUserPings = function(userId, cb) {
	this.queryRows("select player, room, name, message from ping, room where player=$1 and room.id=ping.room", [userId], cb);
}

// returns the id and name of the rooms where the user has been pinged since a certain time (seconds since epoch)
Con.prototype.fetchUserPingRooms = function(userId, after, cb) {
	this.queryRows("select room, max(name) as roomname, max(created) as last from ping, room where player=$1 and room.id=ping.room and created>$2 group by room", [userId, after], cb);
}

Con.prototype.updateGetMessage = function(messageId, expr, userId, cb){
	var con = this;
	con.client.query("update message set "+expr+" where id=$1", [messageId], function(err, res){
		if (err) return con.nok(cb, err);
		con.getMessage(messageId, userId, cb);
	});
}

Con.prototype.addVote = function(roomId, userId, messageId, level, cb) {
	var con = this, sql, args;
	switch (level) {
	case 'pin': case 'star': case 'up': case 'down':
		sql = "insert into message_vote (message, player, vote) select $1, $2, $3";
		sql += " where exists(select * from message where id=$1 and room=$4)"; // to avoid users cheating by voting on messages they're not allowed to
		args = [messageId, userId, level, roomId];
		break;
	default:
		return cb(new Error('Unknown vote level'));
	}
	con.client.query(sql, args, function(err, res){
		if (err) return con.nok(cb, err);
		con.updateGetMessage(messageId, level+"="+level+"+1", userId, cb);
	});
}
Con.prototype.removeVote = function(roomId, userId, messageId, level, cb) {
	var con = this;
	con.client.query("delete from message_vote where message=$1 and player=$2 and vote=$3", [messageId, userId, level], function(err, res){
		if (err) return con.nok(cb, err);
		con.updateGetMessage(messageId, level+"="+level+"-1", userId, cb);
	});
}

Con.prototype.storeRoom = function(r, author, cb) {
	var con = this, now = ~~(Date.now()/1000);
	if (r.id) {
		this.queryRow(
			"update room set name=$1, private=$2, description=$3 where id=$4"+
			" and exists(select auth from room_auth where player=$5 and room=$4 and auth>='admin')",
			[r.name, r.private, r.description||'', r.id, author.id], cb
		);
	} else {
		con.client.query(
			'insert into room (name, private, description) values ($1, $2, $3) returning id',
			[r.name, r.private, r.description||''],
			function(err, result)
		{
			if (err) return con.nok(cb, err);
			r.id = result.rows[0].id;
			con.queryRow(
				'insert into room_auth (room, player, auth, granted) values ($1, $2, $3, $4)',
				[r.id, author.id, 'own', now], cb
			);
		});		
	}
}

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
// cb(err, con)
exports.con = function(cb) {
	pool.connect(function(err, client, done){
		if (err) cb(err);
		else cb(null, new Con(client, done));		
	});
}
