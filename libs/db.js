"use strict";

// postgresql persistence
// Usage :
//   
//  db.on(req.user)                             // returns a promise bound to the connection taken from the pool
//  .then(db.updateUser)                        // querying functions are available on the db object and use the connection (context of the call)
//  .then(function(user){                       // when you can't use the simple form
//      if (!user.bot) return this.ping(uid)    // `this` is the connection
//  }).finally(db.off);                         // releases the connection which is returned to the pool
// 
//  It's also possible to do transactions :
//
//  db.on(someArg)
//  .then(db.begin)
//  .then(db.doThing)
//  .then(db.doOtherThing)
//  .then(db.commit)
//  .catch(function(err){
//	    alert(err);
//      this.rollback();
//   }).finally(db.off);

const	Promise = require("bluebird"),
	fs = Promise.promisifyAll(require("fs")),
	path = require("path");

var	pg = require('pg'),
	config,
	pool;

Promise.longStackTraces(); // this will be removed in production in the future

// The connection object which is used for all postgress accesses from other files
function Con(){}
var proto = Con.prototype;

var NoRowError = exports.NoRowError = function(){
	this.message = "No Row";
};
NoRowError.prototype = Object.create(Error.prototype);

//////////////////////////////////////////////// #users

// fetches a user found by the OAuth profile, creates it if it doesn't exist
// Important private fields are included in the returned object
//  but not all the secondary info (location, description, website)
proto.getCompleteUserFromOAuthProfile = function(profile){
	var oauthid = profile.id || profile.user_id, // id for google, github and reddit, user_id for stackexchange
		displayName = profile.displayName || profile.display_name || profile.name, // displayName for google and github, display_name for stackexchange, name for reddit
		provider = profile.provider;
	if (!oauthid) throw new Error('no id found in OAuth profile');
	var con = this, resolver = Promise.defer(),
		email = null, returnedCols = 'id, name, lang, oauthprovider, oauthdisplayname, email';
	if (profile.emails && profile.emails.length) email = profile.emails[0].value; // google, github
	con.client.query('select '+returnedCols+' from player where oauthprovider=$1 and oauthid=$2', [provider, oauthid], function(err, result){
		if (err) {
			resolver.reject(err);
		} else if (result.rows.length) {
			resolver.resolve(result.rows[0]);
		} else {
			console.dir(profile);
			resolver.resolve(con.queryRow(
				'insert into player (oauthid, oauthprovider, email, oauthdisplayname) values ($1, $2, $3, $4) returning '+returnedCols,
				[oauthid, provider, email, displayName]
			));
		}
	});
	return resolver.promise.bind(this);
}

// returns an existing user found by his id
// Private fields are included in the returned object
proto.getUserById = function(id){
	return this.queryRow(
		'select id, name, oauthprovider, oauthdisplayname, email, bot, avatarsrc, avatarkey from player where id=$1', [id]
	);
}

// returns an existing user found by his name with a case insensitive search
// Private fields are included in the returned object
proto.getUserByName = function(username){
	return this.queryRow(
		'select id, name, oauthprovider, oauthdisplayname, email, bot, avatarsrc, avatarkey from player where lower(name)=$1',
		[username.toLowerCase()], true
	);
}

// updates the name, avatar_src and avatar_key
proto.updateUser = function(user){
	return this.queryRow(
		'update player set name=$1, avatarsrc=$2, avatarkey=$3 where id=$4',
		[user.name, user.avatarsrc, user.avatarkey, user.id]
	).then(this.fixAllDialogRooms);
}

// saves the additional optional user info (location, description, lang, website)
proto.updateUserInfo = function(id, info){
	return this.queryRow(
		"update player set description=$1, location=$2, url=$3, lang=$4 where id=$5",
		[info.description, info.location, info.url, info.lang, id]
	).then(this.fixAllDialogRooms);
}
proto.getUserInfo = function(id){
	return this.queryRow(
		"select description, location, url, lang from player where id=$1",
		[id]
	);
}

// optm: this is somewhat slow, as a full scan on players in used
proto.listRecentUsers = function(roomId, N){
	return this.queryRows(
		"select a.id, a.mc, player.name, avatarsrc as avs, avatarkey as avk from"+
		" (select message.author as id, max(message.created) as mc from message where room=$1"+
		" group by message.author order by mc desc limit $2) a"+
		" join player on player.id=a.id and player.bot is false", [roomId, N]
	);
}

// lists the users of the room (watching users + users having posted)
proto.listRoomUsers = function(roomId){
	return this.queryRows(
		"select player.id, player.name from"+
		" (select distinct author from message where room=$1"+
		" union select player from watch where room=$1) a"+
		" join player on player.id=a.author and player.bot is false", [roomId]
	);
}

// returns the name to use in ping autocompletion.
// note: use index message_author_created_room on message (author, created, room)
proto.usersStartingWith = function(str, roomId, limit){
	return this.queryRows(
		"select name, (select max(created) from message where p.id=author and room=$1) lir," +
		" (select max(created) from message where p.id=author) l" +
		" from player p where name ilike $2 order by lir desc nulls last, l desc nulls last limit $3",
		[roomId, str+'%', limit]
	);
}

// returns a bot, creates it if necessary
proto.getBot = function(botname){
	return this.queryRow(
		'select id, name, bot, avatarsrc, avatarkey from player where name=$1 and bot is true', [botname], true
	).then(function(player){
		return player || this.queryRow(
			'insert into player (name, bot) values ($1, true) returning id, name, bot',	[botname]
		)	
	})
}

///////////////////////////////////////////// #prefs

// sets a preference (parameters must be valid)
proto.upsertPref = function(userId, name, value){
	return this.upsert('pref', 'value', value, 'player', userId, 'name', name);
}
proto.getPrefs = function(userId){
	return this.queryRows(
		"select name, value from pref where player=$1", [userId]
	);
}

///////////////////////////////////////////// #rooms

proto.createRoom = function(r, owners){
	return this.queryRow(
		'insert into room (name, private, listed, dialog, description, lang) values ($1, $2, $3, $4, $5, $6) returning id',
		[r.name, r.private, r.listed, r.dialog, r.description||'', r.lang||'en']
	).then(function(row){
		r.id = row.id;
		return owners;
	}).map(function(user){
		return this.queryRow(
			'insert into room_auth (room, player, auth, granted) values ($1, $2, $3, $4)',
			[r.id, user.id, 'own', now()]
		);
	})
}

proto.updateRoom = function(r, author, authlevel) {
	if (authlevel==="own") {
		return this.queryRow(
			"update room set name=$1, private=$2, listed=$3, dialog=$4, description=$5, lang=$6 where id=$7",
			[r.name, r.private, r.listed, r.dialog, r.description||'', r.lang, r.id]
		);
	} else { // implied : "admin"
		return this.queryRow(
			"update room set name=$1, listed=$2, description=$3, lang=$4 where id=$5",
			[r.name, r.listed, r.description||'', r.lang, r.id]
		);			
	}
}

// ensures the name and lang of every dialog room is correct according to user names and lang 
proto.fixAllDialogRooms = function(){
	console.log("Fixing all dialog room names");
	return this.execute(
		"update room set name=concat(u1.name,' & ',u2.name), lang=coalesce(u1.lang,u2.lang,'en')"+
		" from player u1, room_auth a1, player u2, room_auth a2"+
		" where a1.room=room.id and a1.player=u1.id and a1.auth>='admin'"+
		" and a2.room=room.id and a2.player>a1.player and a2.player=u2.id and a2.auth>='admin'"+
		" and dialog is true"
	);
}

// obtains a lounge : a room initially made for a private discussion between two users
proto.getLounge = function(userA, userB){
	var con = this, resolver = Promise.defer();
	this.client.query(
		"select * from room r, room_auth aa, room_auth ab"+
		" where r.private is true and r.listed is false and r.dialog is true"+
		" and aa.room=r.id and aa.player=$1 and aa.auth>='admin'"+
		" and ab.room=r.id and ab.player=$2 and ab.auth>='admin'"+
		" and not exists(select * from room_auth where room=r.id and player!=$1 and player!=$2)",
		[userA.id, userB.id], function(err, res)
	{
		if (err) return resolver.reject(err);
		if (res.rows.length) return resolver.resolve(res.rows[0]);		
		var name = userA.name + ' & ' + userB.name,
			description = 'A private lounge for '+userA.name+' and '+userB.name,
			room = {name:name, description:description, private:true, listed:false, dialog:true};
			room.lang = userA.lang || userB.lang || 'en'; // userA usually is a "completeUser"
		con.createRoom(room, [userA,userB]).then(function(){ resolver.resolve(room) });
	});
	return resolver.promise.bind(this);
}

// returns an existing room found by its id
proto.fetchRoom = function(id){
	return this.queryRow('select id, name, description, private, listed, dialog, lang from room where id=$1', [id]);
}

// returns an existing room found by its id and the user's auth level
proto.fetchRoomAndUserAuth = function(roomId, userId, dontThrowIfNoRow){
	if (!roomId) throw new NoRowError();
	return this.queryRow(
		"select id, name, description, private, listed, dialog, lang, auth from room"+
		" left join room_auth a on a.room=room.id and a.player=$1 where room.id=$2",
		[userId, roomId],
		dontThrowIfNoRow
	);
}

// lists the rooms a user can access, either public or whose access was explicitely granted
proto.listAccessibleRooms = function(userId){
	return this.queryRows(
		"select id, name, description, private, dialog, listed, lang, auth from room r left join room_auth a on a.room=r.id and a.player=$1"+
		" where private is false or auth is not null order by auth desc nulls last, name", [userId]
	);
}

// lists the rooms that should make it to the front page
proto.listFrontPageRooms = function(userId){
	return this.queryRows(
		"select r.id, name, description, private, listed, dialog, lang, auth,"+
		" (select max(created) from message m where m.room = r.id) as lastcreated,"+
		" (select exists (select 1 from message m where m.room = r.id and m.author='840')) as hasself"+ // use index message_room_author
		" from room r left join room_auth a on a.room=r.id and a.player=$1"+  
		" where listed is true or auth is not null"+
		" order by lastcreated desc nulls last limit 200", [userId]
	);
}

proto.listRecentUserRooms = function(userId){
	return this.queryRows(
		"select m.id, m.number, m.last_created, r.name, r.description, r.private, r.listed, r.dialog, r.lang"+
		" from ("+
			"select m.room as id, count(*) number, max(created) last_created"+
			" from message m"+
			" where author=$1"+
			" group by room "+
		") m"+
		" join room r on r.id = m.id"+
		" where r.listed is true"+
		" order by m.last_created desc limit 10", [userId]
	);
}


///////////////////////////////////////////// #auths

proto.deleteAccessRequests = function(roomId, userId){
	return this.execute('delete from access_request where room=$1 and player=$2', [roomId, userId])
}

proto.insertAccessRequest = function(roomId, userId, message){
	return this.queryRow(
		'insert into access_request (room, player, requested, request_message) values ($1, $2, $3, $4) returning *',
		[roomId, userId, now(), message]
	);
}

// userId : optionnal
proto.listOpenAccessRequests = function(roomId, userId){
	var sql = "select player,name,requested,request_message from player p,access_request r where r.denied is null and r.player=p.id and room=$1", args = [roomId];		
	if (userId) {
		sql += " and player=?";
		args.push(userId);
	}
	return this.queryRows(sql, args);
}

proto.getLastAccessRequest = function(roomId, userId){
	return this.queryRow(
		"select player,requested,request_message,denied,deny_message from access_request where room=$1 and player=$2 order by denied desc limit 1",
		[roomId, userId], true
	);
}

// lists the authorizations a user has
proto.listUserAuths = function(userId){
	return this.queryRows("select id, name, description, auth from room r, room_auth a where a.room=r.id and a.player=$1", [userId]);
}

// lists the authorizations of the room
proto.listRoomAuths = function(roomId){
	return this.queryRows(
		"select id, name, auth, player, granter, granted from player p, room_auth a where a.player=p.id and a.room=$1 order by auth desc, name",
		[roomId]
	);
}

// do actions on user rights
// userId : id of the user doing the action (at least an admin of the room)
proto.changeRights = function(actions, userId, room){
	var con = this;
	return Promise.map(actions, function(a){
		var sql, args;
		switch (a.cmd) {
		case "insert_auth": // we can assume there's no existing auth
			sql = "insert into room_auth (room, player, auth, granter, granted) values ($1, $2, $3, $4, $5)";
			args = [room.id, a.user, a.auth, userId, now()];
			break;
		case "delete_ar":
			sql = "delete from access_request where room=$1 and player=$2";
			args = [room.id, a.user];
			break;
		case "deny_ar":
			sql = "update access_request set denied=$1, deny_message=$2 where room=$3 and player=$4";
			args = [now(), (a.message||'').slice(0,200), room.id, a.user];
			break;
		case "update_auth":
			// the exists part is used to check the user doing the change has at least as much auth than the modified user
			sql = "update room_auth ma set auth=$1 where ma.player=$2 and ma.room=$3 and exists (select * from room_auth ua where ua.player=$4 and ua.room=$5 and ua.auth>=ma.auth)";
			args = [a.auth, a.user, room.id, userId, room.id];
			break;
		case "delete_auth":
			// the exists part is used to check the user doing the change has at least as much auth than the modified user
			sql = "delete from room_auth ma where ma.player=$1 and ma.room=$2 and exists (select * from room_auth ua where ua.player=$3 and ua.room=$2 and ua.auth>=ma.auth)";
			args = [a.user, room.id, userId];
			break;
		case "unban":
			sql = "delete from ban where id=$1 and room=$2";
			args = [a.id, room.id];
			break;
		}
		return con.queryRow(sql, args, true);
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

proto.getAuthLevel = function(roomId, userId){
	return this.queryRow(
		"select auth from room_auth where player=$1 and room=$2",
		[userId, roomId], true
	);
}

// look for the user's authorization with a case insensitive search
proto.getAuthLevelByUsername = function(roomId, username){
	return this.queryRow(
		"select auth from room_auth,player where lower(name)=$1 and room=$2 and room_auth.player=player.id;",
		[username.toLowerCase(), roomId], true
	);
}

//////////////////////////////////////////////// #watch

proto.insertWatch = function(roomId, userId){
	return this.execute("insert into watch(room, player) values($1,$2)", [roomId, userId]);
}

proto.deleteWatch = function(roomId, userId){
	return this.execute("delete from watch where room=$1 and player=$2", [roomId, userId]);
}

proto.listUserWatches = function(userId){
	return this.queryRows(
		"select w.room id, r.name, r.private, r.dialog from watch w join room r on w.room=r.id"+
		" left join room_auth a on a.room=r.id and a.player=$1"+
		" where w.player=$1 and (r.private is false or a.auth is not null)",
		[userId]
	);
}

//////////////////////////////////////////////// #ban


proto.insertBan = function(roomId, bannedId, now, expires, bannerId, reason){
	return this.queryRow(
		"insert into ban(banned, room, banner, bandate, expires, reason) values ($1, $2, $3, $4, $5, $6) returning *",
		[bannedId, roomId, bannerId, now, expires, reason.slice(0,255)]
	);
}

proto.listActiveBans = function(roomId){
	return this.queryRows(
		"select ban.*, banned.name as bannedname, banner.name as bannername from ban" +
		" left join player banned on banned.id=banned"+
		" left join player banner on banner.id=banner"+
		" where room=$1 and expires>$2 order by banned", [roomId, now()]
	);
}

proto.getRoomUserActiveBan = function(roomId, userId){
	return this.queryRow("select * from ban where room=$1 and banned=$2 and expires>$3 order by expires desc limit 1", [roomId, userId, now()], true);	
}

//////////////////////////////////////////////// #messages

// get a sequence of messages.
// Exemples :
//  - querying the last messages of the room :
//     getMessages(roomId, userId, n, false);
//  - querying at least n messages whose id is older or equal to A but not including B :
//     getMessages(roomId, userId, n, false, '<', A, '>', B);
//  - querying messages after A (including it) :
//     getMessages(roomId, userId, n, false, '>=', A);
// The last messages may contain the id of the previous or following messages (the one
//  that we didn't fetch because of N)
proto.getMessages = function(roomId, userId, N, asc, c1, s1, c2, s2){
	var args = [roomId, userId, N], messages,
		sql = 'select message.id, author, player.name as authorname, player.bot,'+
		' player.avatarsrc as avs, player.avatarkey as avk,'+
		' room, content, message.created as created, message.changed,'+
		' pin, star, up, down, vote, score from message'+
		' left join message_vote on message.id=message and message_vote.player=$2'+
		' inner join player on author=player.id where room=$1';
	if (s1) {
		sql += ' and message.id'+c1+'$4';
		args.push(s1);
		if (s2) {
			sql += ' and message.id'+c2+'$5';
			args.push(s2);
		}
	}
	sql += ' order by message.id '+ ( asc ? 'asc' : 'desc') + ' limit $3';
	return this.queryRows(sql, args).then(function(rows){
		messages = rows;
		return rows.length<N ? 0 : this.getNextMessageId(roomId, rows[rows.length-1].id, asc);
	}).then(function(next){
		if (next) messages[messages.length-1][asc?'next':'prev']=next.mid;
		return messages;
	});
}

proto.getNextMessageId = function(roomId, mid, asc){
	return this.queryRow(
		asc?
		"select min(id) mid from message where room=$1 and id>$2":
		"select max(id) mid from message where room=$1 and id<$2",
		[roomId, mid], true
	);
}

proto.getNotableMessages = function(roomId, createdAfter){
	return this.queryRows(
		'select message.id, author, player.name as authorname, player.bot, room, content, created, pin, star, up, down, score from message'+
		' inner join player on author=player.id where room=$1 and (created>$2 or pin>0) and score>4'+
		' order by pin desc, created desc, score desc limit 20', [roomId, createdAfter]
	);
}

proto.search = function(roomId, pattern, lang, N){
	return this.queryRows(
		"select message.id, author, player.name as authorname, room, content, created, pin, star, up, down, score from message"+
		" inner join player on author=player.id"+
		" where to_tsvector($1, content) @@ plainto_tsquery($1,$2) and room=$3 order by message.id desc limit $4",
		[lang, pattern, roomId, N]
	);
}

// accepts a tsquery for example 'dog&!cat' (find dogs but filter out cats)
proto.search_tsquery = function(roomId, tsquery, lang, N){
	return this.queryRows(
		"select message.id, author, player.name as authorname, room, content, created, pin, star, up, down, score from message"+
		" inner join player on author=player.id"+
		" where to_tsvector($1, content) @@ to_tsquery($1,$2) and room=$3 order by message.id desc limit $4",
		[lang, tsquery, roomId, N]
	);
}

// builds an histogram, each record relative to a utc day
proto.messageHistogram = function(roomId, pattern, lang) {
	return pattern ? this.queryRows(
			"select count(*) n, min(id) m, floor(created/86400) d from message where room=$1"+
			" and to_tsvector($2, content) @@ plainto_tsquery($2,$3)"+
			" group by d order by d", [roomId, lang, pattern]
		) : this.queryRows("select count(*) n, min(id) m, floor(created/86400) d from message where room=$1 group by d order by d", [roomId]);
}

// fetches one message. Votes of the passed user are included if user is provided
// avatar isn't given (now)
proto.getMessage = function(messageId, userId){
	if (userId) {
		return this.queryRow(
			'select message.id, author, player.name as authorname, player.bot, room, content,'+
			' message.created as created, message.changed, pin, star, up, down, vote, score from message'+
			' left join message_vote on message.id=message and message_vote.player=$2'+
			' inner join player on author=player.id'+
			' where message.id=$1', [messageId, userId]
		)
	} else {
		return this.queryRow(
			'select message.id, author, player.name as authorname, player.bot, room, content,'+
			' message.created as created, message.changed, pin, star, up, down, score from message'+
			' inner join player on author=player.id'+
			' where message.id=$1', [messageId]
		)
	}
}

// if id is set, updates the message if the author & room matches
// else stores a message and sets its id
proto.storeMessage = function(m, dontCheckAge){
	if (m.id) {
		var savedAuthorname = m.authorname,
			sql = 'update message set content=$1, changed=$2 where id=$3 and room=$4 and author=$5';
		if (!dontCheckAge) sql += ' and created>'+(now()-config.maxAgeForMessageEdition);
		sql += ' returning *';
		return this.queryRow(sql, [m.content, m.changed||0, m.id, m.room, m.author]).then(function(m){
			m.authorname = savedAuthorname;
			if (m.content.length || m.created<now()-config.maxAgeForMessageTotalDeletion) return m;
			return this.queryRow(
				"delete from ping where message=$1", [m.id], true
			).then(function(){
				return this.queryRow(
					"delete from message_vote where message=$1", [m.id], true
				)
			}).then(function(){ 
				return this.queryRow(
					"delete from message where id=$1", [m.id]
				)
			}).then(function(){ 
				return m
			});
		});
	}
	return this.queryRow(
		'insert into message (room, author, content, created) values ($1, $2, $3, $4) returning id',
		[m.room, m.author, m.content, m.created]
	).then(function(row){
		m.id = row.id;
		return m;
	});
}

proto.updateGetMessage = function(messageId, expr, userId){
	return this.queryRow("update message set "+expr+" where id=$1", [messageId])
	.then(function(){
		return this.getMessage(messageId, userId);
	});
}

//////////////////////////////////////////////// #pings

proto.storePing = function(roomId, userId, messageId){
	return this.queryRow("insert into ping(room, player, message, created) values ($1,$2,$3,$4)", [roomId, userId, messageId, now()]);
}

// users must be a sanitized array of usernames
proto.storePings = function(roomId, users, messageId){
	return this.execute(
		"insert into ping (room, player, message, created) select " +
		roomId + ", id, " + messageId + ", " + now() +
		" from player where lower(name) in (" + users.map(function(n){ return "'"+n.toLowerCase()+"'" }).join(',') + ")"
	);
}

// delete any ping
proto.deletePing = function(mid, userId){
	return this.execute("delete from ping where message=$1 and player=$2", [mid, userId]);
}

proto.deleteRoomPings = function(roomId, userId){
	return this.execute("delete from ping where room=$1 and player=$2", [roomId, userId]);
}

proto.deleteRoomsPings = function(roomIds, userId){
	if (roomIds.length===1) return this.deleteRoomPings(roomIds[0], userId);
	return this.execute("delete from ping where room in ("+roomIds.join(',')+") and player=$1", [userId]);
}

proto.deleteAllUserPings = function(userId){
	return this.execute("delete from ping where player=$1", [userId]);
}

proto.fetchUserPings = function(userId){
	return this.queryRows(
		"select message.room r, room.name rname, player.name authorname, ping.message mid, content from ping"+
		" inner join message on message=message.id"+
		" inner join player on author=player.id"+
		" inner join room on room.id=ping.room"+
		" where player=$1", [userId]
	);
}

// returns the id and name of the rooms where the user has been pinged since a certain time (seconds since epoch)
// fixme : this query is slow (50ms for no record)
proto.fetchUserPingRooms = function(userId, after){
	return this.queryRows(
		"select room, max(name) as roomname, min(created) as first, max(created) as last from ping, room"+
		" where player=$1 and room.id=ping.room and created>$2 group by room",
		[userId, after]
	);
}

//////////////////////////////////////////////// #votes

proto.addVote = function(roomId, userId, messageId, level){
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
	return this.queryRow(sql, args, true)
	.then(function(nb){
		if (nb) return this.updateGetMessage(messageId, level+"="+level+"+"+nb, userId);
	});
}
proto.removeVote = function(roomId, userId, messageId, level){
	return this.queryRow("delete from message_vote where message=$1 and player=$2 and vote=$3", [messageId, userId, level], true)
	.then(function(removedOne){
		if (removedOne)	return this.updateGetMessage(messageId, level+"="+level+"-1", userId);
	});
}
// the administrative unpin removes all pins. Pins of other users are converted to stars (except the message's author).
proto.unpin = function(roomId, userId, messageId){
	return this.queryRow(
		"update message_vote set vote='star' where message=$1 and player!=$2 and vote='pin'" +
		" and exists(select * from message where id=$1 and room=$3 and author!=player)",
		[messageId, userId, roomId],
		true
	).then(function(nbconversions){
		return [
			nbconversions,
			this.queryRow("delete from message_vote where message=$1 and vote='pin'", [messageId], true)
		];
	}).spread(function(nbconversions){
		var expr = "pin=0";
		if (nbconversions) expr += ",star=star+"+nbconversions;
		return this.updateGetMessage(messageId, expr, userId);
	})
}

//////////////////////////////////////////////// #plugin

proto.storePlayerPluginInfo = function(plugin, userId, info) {
	return this.queryRow("insert into plugin_player_info (plugin, player, info) values($1, $2, $3)", [plugin, userId, info])
}

proto.getPlayerPluginInfo = function(plugin, userId) {
	return this.queryRow("select * from plugin_player_info where plugin=$1 and player=$2", [plugin, userId], true);
}

proto.deletePlayerPluginInfo = function(plugin, userId) {
	return this.queryRow("delete from plugin_player_info where plugin=$1 and player=$2", [plugin, userId], true);
}

//////////////////////////////////////////////// #patches & versions

proto.getComponentVersion = function(component){
	return this.queryRow("select version from db_version where component=$1", [component], true)
	.then(function(row){
		return row ? row.version : 0;
	});
}

// applies the not yet applied patches for a component. This is automatically called
//  for the core of miaou but it may also be called by plugins (including for
//  initial installation of the plugin)
exports.upgrade = function(component, patchDirectory, cb){
	patchDirectory = path.resolve(__dirname, '..', patchDirectory); // because we're in ./libs
	var startVersion, endVersion;
	var p = on(component)
	.then(proto.getComponentVersion)
	.then(function(version){
		console.log('Component '+component+' : current version='+version);
		startVersion = version;
	}).then(function(){
		return fs.readdirAsync(patchDirectory)
	}).then(function(names){
		return names.map(function(name){
			var m = name.match(/^(\d+)-(.*).sql$/);
			return m ? { name:m[2],	num:+m[1], filename:name } : null;
		}).filter(function(p){ return p && p.num>startVersion })
		.sort(function(a,b){ return a.num-b.num });
	}).then(function(patches){
		if (!patches.length) return console.log('Component '+component+' is up to date.');
		endVersion = patches[patches.length-1].num;
		console.log('Component '+component+' must be upgraded from version '+startVersion+' to '+endVersion);			
		return Promise.cast(patches).bind(this)
		.then(proto.begin)
		.reduce(function(_, patch){
			console.log('Applying patch '+patch.num+' : '+patch.name);
			return Promise.cast(patchDirectory+'/'+patch.filename).bind(this)
			.then(fs.readFileAsync.bind(fs))
			.then(function(buffer){
				return buffer.toString().replace(/(#[^\n]*)?\n/g,' ').split(';')
				.map(function(s){ return s.trim() }).filter(function(s){ return s });
			}).map(function(statement){
				console.log(' Next statement :', statement);
				return this.execute(statement)
			});
		}, 'see https://github.com/petkaantonov/bluebird/issues/70')
		.then(function(){
			return this.execute("delete from db_version where component=$1", [component])
		}).then(function(){
			return this.execute("insert into db_version (component,version) values($1,$2)", [component, endVersion])
		}).then(proto.commit)
		.then(function(){
			console.log('Component '+component+' successfully upgraded to version '+endVersion)
		}).catch(function(err){
			console.log('An error prevented DB upgrade : ', err);
			console.log('All changes are rollbacked');
			return this.rollback();
		})
	}).finally(proto.off)
	if (cb) p.then(cb)
}

//////////////////////////////////////////////// #global API

function now(){
	return Date.now()/1000|0;
}

function logQuery(sql, args){ // used in debug
	console.log(sql.replace(/\$(\d+)/g, function(_,i){ var s=args[i-1]; return typeof s==="string" ? "'"+s+"'" : s }));
}

// must be called before any call to connect
exports.init = function(miaouConfig, cb){
	config = miaouConfig;
	if (config.database.native_pg) {
		console.log("Using native driver to connect to PostgreSQL");
		pg = pg.native;
	} else {
		console.log("Using NOT native driver to connect to PostgreSQL");
	}
	var conString = config.database.url;
	pg.defaults.parseInt8 = true;
	pg.connect(conString, function(err, client, done){
		if (err) return console.log('Connection to PostgreSQL database failed');
		done();
		console.log('Connection to PostgreSQL database successful');
		pool = pg.pools.all[JSON.stringify(conString)];
		exports.upgrade('core', 'sql/patches', cb);
	})
}

// returns a promise bound to a connection, available to issue queries
//  The connection must be released using off
var on = exports.on = function(val){
	var con = new Con();
	return new Promise(function(resolve, reject){
		pool.connect(function(err, client, done){
			if (err) {
				reject(err);
			} else {
				con.client = client;
				con.done = done;
				resolve(val);
			}
		});
	}).bind(con);
}

// releases the connection which returns to the pool
// It's ok to call this function more than once
proto.off = function(v){
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
	return v;
}

// throws a NoRowError if no row was found (select) or affected (insert, delete, update)
//  apart if noErrorOnNoRow
proto.queryRow = function(sql, args, noErrorOnNoRow){
	var	con = this,
		start = Date.now();
	return new Promise(function(resolve, reject){
		con.client.query(sql, args, function(err, res){
			//~ logQuery(sql, args);
			var end = Date.now();
			if (end-start>50) {
				console.log("Slow query (" + (end-start) + " ms) :");
				logQuery(sql, args);
			}
			if (err) {
				console.log('Error in query:');
				logQuery(sql, args);
				reject(err);
			} else if (res.rows.length) {
				resolve(res.rows[0]);
			} else if (res.rowCount) {
				resolve(res.rowCount);
			} else {
				if (noErrorOnNoRow) resolve(null);
				else reject(new NoRowError());
			}
		});
	}).bind(this);
}

// exemple : upsert('pref', 'value', 'normal', 'player', 3, 'name', 'notif')
// This code will be removed as soon as postgresql 9.5 is available...
proto.upsert = function(table, changedColumn, newValue, conditions){
	var	con = this,
		resolver = Promise.defer(),
		sql = "update "+table+" set "+changedColumn+"=$1",
		args = [newValue],
		colnames = [changedColumn],
		nbConditions = (arguments.length-3)>>1;
	for (var i=0; i<nbConditions; i++){
		colnames.push(arguments[i*2+3]);
		sql += (i ? " and " : " where ") + arguments[i*2+3] + "=$"+(i+2)
		args.push(arguments[i*2+4]);
	}
	con.client.query(sql, args, function(err, res){
		if (err) {
			console.log('Error in query:');
			logQuery(sql, args);
			resolver.reject(err);
			return;
		}
		if (res.rowCount) {
			resolver.resolve();
			return;
		}
		var	valnums = ["$1"];
		for (var i=0; i<nbConditions; i++){
			valnums.push('$'+(i+2));
		}
		sql = "insert into "+table+"("+colnames.join(',')+") values("+valnums.join(',')+")";
		con.client.query(sql, args, function(err, res){
			if (err) {
				console.log('Error in query:');
				logQuery(sql, args);
				resolver.reject(err);
			} else {
				resolver.resolve();
			}
		});
	});
	return resolver.promise.bind(this);	
}

proto.queryRows = proto.execute = function(sql, args){
	var	con = this,
		start = Date.now();
	return new Promise(function(resolve, reject){
		con.client.query(sql, args, function(err, res){
			//~ logQuery(sql, args);
			var end = Date.now();
			if (end-start>50) {
				console.log("Slow query (" + (end-start) + " ms) :");
				logQuery(sql, args);
			}
			if (err) {
				console.log('Error in query:');
				logQuery(sql, args);
				reject(err);
			} else {
				resolve(res.rows);
			}
		});
	}).bind(this);
}

;['begin','rollback','commit'].forEach(function(s){
	proto[s] = function(arg){ return this.execute(s).then(function(){ return arg }) }
});

for (var fname in proto) {
	if (proto.hasOwnProperty(fname) && typeof proto[fname] === "function") {
		exports[fname] = proto[fname];
	}
}
