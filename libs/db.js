// postgresql persistence
// Usage :
//
//  db.on(req.user)                             // returns a promise bound to the connection taken from the pool
//  .then(db.updateUser)                        // querying functions are available on the db object
//                                              // and use the connection (context of the call)
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
	bench = require("./bench.js"),
	path = require("path");

var	pg = require('pg'),
	nbQueries = 0,
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
// Sources of data depend on the oauth provider:
// - oauthid: id for google, github and reddit, user_id for stackexchange
// - displayName: displayName for google and github, display_name for stackexchange, name for reddit
proto.getCompleteUserFromOAuthProfile = function(profile){
	var	oauthid = profile.id || profile.user_id,
		displayName = profile.displayName || profile.display_name || profile.name,
		provider = profile.provider;
	if (!oauthid) throw new Error('no id found in OAuth profile');
	var	resolver = Promise.defer(),
		email = null, returnedCols = 'id, name, lang, oauthprovider, oauthdisplayname, email',
		sql = 'select '+returnedCols+' from player where oauthprovider=$1 and oauthid=$2';
	if (profile.emails && profile.emails.length) email = profile.emails[0].value; // google, github
	this.client.query(sql, [provider, oauthid], (err, result)=>{
		if (err) {
			resolver.reject(err);
		} else if (result.rows.length) {
			resolver.resolve(result.rows[0]);
		} else {
			console.dir(profile);
			var sql = 'insert into player (oauthid, oauthprovider, email, oauthdisplayname)' +
				' values ($1, $2, $3, $4) returning '+returnedCols;
			resolver.resolve(
				this.queryRow(
					sql,
					[oauthid, provider, email, displayName],
					"insert_player", false
				)
			);
		}
	});
	return resolver.promise.bind(this);
}

// returns an existing user found by his id
// Private fields are included in the returned object
proto.getUserById = function(id){
	return this.queryRow(
		'select id, name, oauthprovider, oauthdisplayname, email, bot, avatarsrc, avatarkey'+
		' from player where id=$1',
		[id],
		"user_by_id"
	);
}

// returns an existing user found by his name with a case insensitive search
// Private fields are included in the returned object
proto.getUserByName = function(username){
	return this.queryOptionalRow(
		'select id, name, oauthprovider, oauthdisplayname, email, bot, avatarsrc, avatarkey'+
		' from player where lower(name)=$1',
		[username.toLowerCase()],
		"user_by_name", false
	);
}

// updates the name, avatar_src and avatar_key
proto.updateUser = function(user){
	return this.queryRow(
		'update player set name=$1, avatarsrc=$2, avatarkey=$3 where id=$4',
		[user.name, user.avatarsrc, user.avatarkey, user.id],
		"update_user"
	).then(this.fixAllDialogRooms);
}

// saves the additional optional user info (location, description, lang, website)
proto.updateUserInfo = function(id, info){
	return this.queryRow(
		"update player set description=$1, location=$2, url=$3, lang=$4 where id=$5",
		[info.description, info.location, info.url, info.lang, id],
		"update_user_info"
	).then(this.fixAllDialogRooms);
}

proto.getUserInfo = function(id){
	return this.queryRow(
		"select description, location, url, lang from player where id=$1",
		[id],
		"get_user_info"
	);
}

// uses index message_room_author_created (but still not lighning fast)
proto.listRecentUsers = function(roomId, N){
	return this.queryRows(
		"select a.id, a.mc, player.name, avatarsrc as avs, avatarkey as avk from"+
		" (select message.author as id, max(message.created) as mc from message where room=$1"+
		" group by message.author order by mc desc limit $2) a"+
		" join player on player.id=a.id and player.bot is false",
		[roomId, N],
		"list_recent_users", true
	);
}

// lists the users of the room (watching users + users having posted)
proto.listRoomUsers = function(roomId){
	return this.queryRows(
		"select player.id, player.name from"+
		" (select distinct author from message where room=$1"+
		" union select player from watch where room=$1) a"+
		" join player on player.id=a.author and player.bot is false",
		[roomId],
		"list_room_users", true
	);
}

// returns the name to use in ping autocompletion.
// Room users are listed first
// uses index message_author_created_room
proto.usersStartingWith = function(str, roomId, limit){
	return this.queryRows(
		"select name, (select max(created) from message where p.id=author and room=$1) lir," +
		" (select max(created) from message where p.id=author) l" +
		" from player p where name ilike $2 order by lir desc nulls last, l desc nulls last limit $3",
		[roomId, str+'%', limit],
		"users_starting_with"
	);
}

// returns a bot, creates it if necessary
proto.getBot = function(botname){
	return this.queryOptionalRow(
		'select id, name, bot, avatarsrc, avatarkey from player where name=$1 and bot is true',
		[botname],
		"get_bot"
	).then(function(player){
		return player || this.queryRow(
			'insert into player (name, bot) values ($1, true) returning id, name, bot',
			[botname],
			"insert_bot"
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
		"select name, value from pref where player=$1",
		[userId],
		"get_prefs", false
	);
}

///////////////////////////////////////////// #rooms

proto.createRoom = function(r, owners){
	return this.queryRow(
		'insert into room (name, private, listed, dialog, description, lang)'+
		' values ($1, $2, $3, $4, $5, $6) returning id',
		[r.name, r.private, r.listed, r.dialog, r.description||'', r.lang||'en'],
		"insert_room"
	).then(function(row){
		r.id = row.id;
		return owners;
	}).map(function(user){
		return this.queryRow(
			'insert into room_auth (room, player, auth, granted) values ($1, $2, $3, $4)',
			[r.id, user.id, 'own', now()],
			"insert_room_owner"
		);
	})
}

proto.updateRoom = function(r, author, authlevel){
	if (authlevel==="own") {
		return this.queryRow(
			"update room set name=$1, private=$2, listed=$3, dialog=$4, description=$5, lang=$6 where id=$7",
			[r.name, r.private, r.listed, r.dialog, r.description||'', r.lang, r.id],
			"update_room_as_owner"
		);
	} else { // implied : "admin"
		return this.queryRow(
			"update room set name=$1, listed=$2, description=$3, lang=$4 where id=$5",
			[r.name, r.listed, r.description||'', r.lang, r.id],
			"update_room_as_admin"
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
		" and dialog is true",
		null,
		"fix_all_dialog_rooms", false
	);
}

// obtains a lounge : a room initially made for a private discussion between two users
proto.getLounge = function(userA, userB){
	var resolver = Promise.defer();
	this.client.query(
		"select * from room r, room_auth aa, room_auth ab"+
		" where r.private is true and r.listed is false and r.dialog is true"+
		" and aa.room=r.id and aa.player=$1 and aa.auth>='admin'"+
		" and ab.room=r.id and ab.player=$2 and ab.auth>='admin'"+
		" and not exists(select * from room_auth where room=r.id and player!=$1 and player!=$2)",
		[userA.id, userB.id],
		(err, res)=>{
			if (err) return resolver.reject(err);
			if (res.rows.length) return resolver.resolve(res.rows[0]);
			var	name = userA.name + ' & ' + userB.name,
				description = 'A private lounge for '+userA.name+' and '+userB.name,
				room = {name:name, description:description, private:true, listed:false, dialog:true};
			room.lang = userA.lang || userB.lang || 'en'; // userA usually is a "completeUser"
			this.createRoom(room, [userA, userB])
			.then(()=> {
				resolver.resolve(room);
			});
		}
	);
	return resolver.promise.bind(this);
}

// returns an existing room found by its id
proto.fetchRoom = function(id){
	return this.queryRow(
		'select id, name, description, private, listed, dialog, lang from room where id=$1',
		[id],
		"fetch_room"
	);
}

// returns an existing room found by its id and the user's auth level
proto.fetchRoomAndUserAuth = function(roomId, userId){
	if (!roomId) return Promise.resolve(null);
	return this.queryOptionalRow(
		"select id, name, description, private, listed, dialog, lang, auth from room"+
		" left join room_auth a on a.room=room.id and a.player=$1 where room.id=$2",
		[userId, roomId],
		"fetch_room_and_user_auth"
	);
}

// lists the rooms that should make it to the front page
// use index message_room_author
proto.listFrontPageRooms = function(userId, pattern){
	var	psname = "list_front_page_rooms",
		sql = "select r.id, r.name, r.description, private, listed, dialog, r.lang, a.auth,"+
		" (select max(created) from message m where m.room = r.id) as lastcreated,"+
		" (select exists (select 1 from message m where m.room = r.id and m.author=$1)) as hasself,"+
		" otheruser.avatarsrc as avs, otheruser.avatarkey as avk"+
		" from room r left join room_auth a on a.room=r.id and a.player=$1"+
		" left join room_auth oua on (r.dialog is true and oua.room=r.id and oua.player!=$1)"+
		" left join player otheruser on otheruser.id = oua.player"+
		" where (listed is true or a.auth is not null)",
		args = [userId];
	if (pattern) {
		psname += "_search";
		sql += " and (r.name ilike $2 or r.description ilike $2)";
		pattern = "%"+pattern+"%";
		args.push(pattern);
	}
	sql += " order by lastcreated desc nulls last limit 200";
	return this.queryRows(sql, args, psname);
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
		" order by m.last_created desc limit 10",
		[userId],
		"list_recent_user_rooms", true
	);
}

///////////////////////////////////////////// #auths

proto.deleteAccessRequests = function(roomId, userId){
	return this.execute(
		'delete from access_request where room=$1 and player=$2',
		[roomId, userId],
		"delete_access_request"
	);
}

proto.insertAccessRequest = function(roomId, userId, message){
	return this.queryRow(
		'insert into access_request (room, player, requested, request_message) values ($1, $2, $3, $4) returning *',
		[roomId, userId, now(), message],
		"insert_access_request"
	);
}

// userId : optionnal
proto.listOpenAccessRequests = function(roomId, userId){
	var	sql = "select player,name,requested,request_message from player p,access_request r"+
		" where r.denied is null and r.player=p.id and room=$1",
		args = [roomId];
	if (userId) {
		sql += " and player=?";
		args.push(userId);
	}
	return this.queryRows(sql, args, "list_open_access_requests", false);
}

proto.getLastAccessRequest = function(roomId, userId){
	return this.queryOptionalRow(
		"select player,requested,request_message,denied,deny_message"+
		" from access_request where room=$1 and player=$2 order by denied desc limit 1",
		[roomId, userId],
		"last_access_request"
	);
}

// get the id of the other user of the room (supposed a dialog room
proto.getOtherDialogRoomUser = function(roomId, userId){
	return this.queryOptionalRow(
		"select id from player p, room_auth a where a.player=p.id and a.room=$1 and p.id!=$2",
		[roomId, userId],
		"get_other_dialog_room_user"
	);
}

// lists the authorizations of the room
proto.listRoomAuths = function(roomId){
	return this.queryRows(
		"select id, name, auth, player, granter, granted from player p, room_auth a"+
		" where a.player=p.id and a.room=$1 order by auth desc, name",
		[roomId],
		"list_room_auths"
	);
}

// do actions on user rights
// userId : id of the user doing the action (at least an admin of the room)
proto.changeRights = function(actions, userId, room){
	return Promise.map(actions, (a)=>{
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
			args = [now(), (a.message||'').slice(0, 200), room.id, a.user];
			break;
		case "update_auth":
			// the exists part is used to check the user doing the change
			//  has at least as much auth than the modified user
			sql = "update room_auth ma set auth=$1 where ma.player=$2 and ma.room=$3 and"+
				" exists (select * from room_auth ua where ua.player=$4 and ua.room=$5 and ua.auth>=ma.auth)";
			args = [a.auth, a.user, room.id, userId, room.id];
			break;
		case "delete_auth":
			// the exists part is used to check the user doing the change
			//  has at least as much auth than the modified user
			sql = "delete from room_auth ma where ma.player=$1 and ma.room=$2 and"+
				" exists (select * from room_auth ua where ua.player=$3 and ua.room=$2 and ua.auth>=ma.auth)";
			args = [a.user, room.id, userId];
			break;
		case "unban":
			sql = "delete from ban where id=$1 and room=$2";
			args = [a.id, room.id];
			break;
		}
		return this.queryRow(sql, args, "change_rights", false);
	});
}

proto.checkAuthLevel = function(roomId, userId, minimalLevel){
	return this.queryOptionalRow(
		"select auth from room_auth where player=$1 and room=$2 and auth>=$3",
		[userId, roomId, minimalLevel],
		"check_auth_level"
	).then(function(row){
		return row ? row.auth : false;
	});
}

proto.getAuthLevel = function(roomId, userId){
	return this.queryOptionalRow(
		"select auth from room_auth where player=$1 and room=$2",
		[userId, roomId],
		"get_auth_level"
	);
}

// look for the user's authorization with a case insensitive search
proto.getAuthLevelByUsername = function(roomId, username){
	return this.queryOptionalRow(
		"select auth from room_auth,player where lower(name)=$1 and room=$2 and room_auth.player=player.id;",
		[username.toLowerCase(), roomId],
		"auth_level_by_username"
	);
}

//////////////////////////////////////////////// #watch

proto.insertWatch = function(roomId, userId){
	return this.execute(
		"insert into watch(room, player, last_seen)"+
		" select $1, $2, (select max(id) from message where room=$1)",
		[roomId, userId],
		"insert_watch"
	);
}
//
// inserts a watch if there's none. Return true if an insert was done
proto.tryInsertWatch = function(roomId, userId){
	return this.execute(
		"insert into watch(room, player, last_seen) ("+
		" select $1, $2, (select max(id) from message where room=$1)"+
		" where not exists ( select * from watch where room=$1 and player=$2 )"+
		")",
		[roomId, userId],
		"try_insert_watch"
	).then(function(res){
		return !!res.rowCount;
	});
}

proto.updateWatch = function(roomId, userId, lastUnseen){
	return this.execute(
		"update watch set last_seen=$3"+
		" where room=$1 and player=$2",
		[roomId, userId, lastUnseen],
		"update_watch"
	);
}

proto.watchRaz = function(roomId, userId){
	return this.execute(
		"update watch set last_seen=(select max(id) from message where message.room=$1)"+
		" where room=$1 and player=$2",
		[roomId, userId],
		"raz_watch"
	);
}

proto.deleteWatch = function(roomId, userId){
	return this.execute("delete from watch where room=$1 and player=$2", [roomId, userId]);
}

proto.listUserWatches = function(userId){
	return this.queryRows(
		"select w.room id, w.last_seen, r.name, r.private, r.dialog, a.auth,"+
		" (select count(*) from message m where m.room=w.room and m.id>w.last_seen) as nbunseen,"+
		" (select count(*) from access_request ar where ar.room=w.room and ar.denied is null) as nbrequests"+
		" from watch w"+
		" join room r on w.room=r.id"+
		" left join room_auth a on a.room=r.id and a.player=$1"+
		" where w.player=$1 and (r.private is false or a.auth is not null)",
		[userId],
		"list_user_watches"
	);
}

//////////////////////////////////////////////// #ban


proto.insertBan = function(roomId, bannedId, now, expires, bannerId, reason){
	return this.queryRow(
		"insert into ban(banned, room, banner, bandate, expires, reason) values ($1, $2, $3, $4, $5, $6) returning *",
		[bannedId, roomId, bannerId, now, expires, reason.slice(0, 255)],
		"insert_ban"
	);
}

proto.listActiveBans = function(roomId){
	return this.queryRows(
		"select ban.*, banned.name as bannedname, banner.name as bannername from ban" +
		" left join player banned on banned.id=banned"+
		" left join player banner on banner.id=banner"+
		" where room=$1 and expires>$2 order by banned",
		[roomId, now()],
		"list_active_bans"
	);
}

proto.getRoomUserActiveBan = function(roomId, userId){
	return this.queryOptionalRow(
		"select * from ban where room=$1 and banned=$2 and expires>$3 order by expires desc limit 1",
		[roomId, userId, now()],
		"room_user_active_ban"
	);
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
	var	args = [roomId, userId, N],
		messages,
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
	return this.queryRows(sql, args, "get_messages", false)
	.then(function(rows){
		messages = rows;
		return rows.length<N ? 0 : this.getNextMessageId(roomId, rows[rows.length-1].id, asc);
	})
	.then(function(next){
		if (next) messages[messages.length-1][asc?'next':'prev']=next.mid;
		return messages;
	});
}

// uses index message_room_id
proto.getNextMessageId = function(roomId, mid, asc){
	if (asc) {
		return this.queryRow(
			"select min(id) mid from message where room=$1 and id>$2",
			[roomId, mid],
			"next_message_id"
		);
	} else {
		return this.queryRow(
			"select max(id) mid from message where room=$1 and id<$2",
			[roomId, mid],
			"previous_message_id"
		);
	}
}

proto.getNotableMessages = function(roomId, createdAfter){
	return this.queryRows(
		'select message.id, author, player.name as authorname, player.bot, room, content,'+
		' created, pin, star, up, down, score from message'+
		' inner join player on author=player.id where room=$1 and (created>$2 or pin>0) and score>4'+
		' order by pin desc, created desc, score desc limit 20',
		[roomId, createdAfter],
		"notable_messages"
	);
}

// appends to the args and conditions arrays, from the s search options
// returns the completed ps name
proto._searchConditions = function(s, args, conditions){
	var psname = "";
	if (s.pattern) {
		psname += "_pattern";
		args.push(s.pattern);
		conditions.push("to_tsvector('english', content) @@ plainto_tsquery('english',$1)");
		// due to the indexing, the only possible language is "english"
	}
	if (s.roomId) {
		psname += "_room";
		args.push(s.roomId);
		conditions.push("room=$1");
	}
	if (s.author) {
		psname += "_author";
		args.push(s.author);
		conditions.push("author=$1");
	}
	if (s.authorName) {
		psname += "_authorName";
		args.push(s.authorName);
		conditions.push("player.name=$1");
	}
	if (s.starrer) {
		psname += "_starrer";
		args.push(s.starrer);
		conditions.push(
			"exists (select * from message_vote mv where mv.player=$1 and mv.message=message.id and mv.vote='star')"
		);
	} else if (s.starred) {
		psname += "_starred";
		conditions.push("star<>0")
	}
	return psname;
}

proto.search = function(s){
	var	psname = "search",
		args = [],
		conditions = [],
		sql = "select message.id, author, player.name as authorname, room, content, created,"+
		" pin, star, up, down, score from message"+
		" inner join player on author=player.id";
	psname += this._searchConditions(s, args, conditions);
	args.push(s.pageSize, s.page*s.pageSize||0);
	return this.queryRows(
		ps(sql, conditions, "order by message.id desc limit $1 offset $2"),
		args,
		psname
	);
}

// accepts a tsquery for example 'dog&!cat' (find dogs but filter out cats)
proto.search_tsquery = function(roomId, tsquery, lang, N){
	return this.queryRows(
		"select message.id, author, player.name as authorname, room, content,"+
		" created, pin, star, up, down, score from message"+
		" inner join player on author=player.id"+
		" where to_tsvector($1, content) @@ to_tsquery($1,$2) and room=$3 order by message.id desc limit $4",
		[lang, tsquery, roomId, N],
		"search_tsquery", false
	);
}

// builds an histogram, each record relative to a utc day
proto.messageHistogram = function(roomId, pattern, lang){
	return pattern
	? this.queryRows(
		"select count(*) n, min(id) m, floor(created/86400) d from message where room=$1"+
		" and to_tsvector($2, content) @@ plainto_tsquery($2,$3)"+
		" group by d order by d",
		[roomId, lang, pattern],
		"histogram_with_patthern"
	) : this.queryRows(
		"select count(*) n, min(id) m, floor(created/86400) d"+
		" from message where room=$1 group by d order by d",
		[roomId],
		"histogram_without_pattern"
	);
}

// fetches one message. Votes of the passed user are included if user is provided
// avatar isn't given (now)
proto.getMessage = function(messageId, userId){
	if (userId) {
		return this.queryRow(
			'select message.id, message.room, author, player.name as authorname, player.bot, room, content,'+
			' message.created as created, message.changed, pin, star, up, down, vote, score from message'+
			' left join message_vote on message.id=message and message_vote.player=$2'+
			' inner join player on author=player.id'+
			' where message.id=$1',
			[messageId, userId],
			"get_message_for_user"
		)
	} else {
		return this.queryRow(
			'select message.id, message.room, author, player.name as authorname, player.bot, room, content,'+
			' message.created as created, message.changed, pin, star, up, down, score from message'+
			' inner join player on author=player.id'+
			' where message.id=$1',
			[messageId],
			"get_message"
		)
	}
}

// if id is set, updates the message if the author & room matches
// else stores a message and sets its id
proto.storeMessage = function(m, dontCheckAge){
	if (!m.room||!m.author) {
		console.log("Invalid message:", m);
		throw new Error("invalid message");
	}
	if (m.id) {
		var	savedAuthorname = m.authorname,
			args = [m.content, m.changed||0, m.id, m.room, m.author],
			name = "update_message",
			sql = 'update message set content=$1, changed=$2 where id=$3 and room=$4 and author=$5';
		if (dontCheckAge) {
			name += "_recent";
		} else {
			args.push(now()-config.maxAgeForMessageEdition);
			sql += ' and created>$6';
		}
		sql += ' returning *';
		return this.queryRow(
			sql, args, name
		)
		.then(function(m){
			m.authorname = savedAuthorname;
			if (m.content.length || m.created<now()-config.maxAgeForMessageTotalDeletion) return m;
			return this.execute(
				"delete from ping where message=$1", [m.id], "delete_message_ping"
			).then(function(){
				return this.execute(
					"delete from message_vote where message=$1", [m.id], "delete_message_vote"
				)
			}).then(function(){
				return this.execute(
					"delete from message where id=$1", [m.id], "delete_message"
				)
			}).then(function(){
				return m
			});
		});
	}
	return this.queryRow(
		'insert into message (room, author, content, created) values ($1, $2, $3, $4) returning id',
		[m.room, m.author, m.content, m.created],
		"insert_message"
	).then(function(row){
		m.id = row.id;
		return m;
	});
}

proto.updateGetMessage = function(messageId, expr, userId){
	return this.queryRow(
		"update message set "+expr+" where id=$1",
		[messageId],
		"update_message_expr",
		false
	)
	.then(function(){
		return this.getMessage(messageId, userId);
	});
}

proto.getLastMessageId = function(roomId){
	return this.queryRow(
		"select max(id) as id from message where room=$1",
		[roomId],
		"last_message_id"
	);
}

//////////////////////////////////////////////// #pings

proto.storePing = function(roomId, userId, messageId){
	return this.execute(
		"insert into ping(room, player, message) values ($1,$2,$3)",
		[roomId, userId, messageId],
		"store_ping"
	);
}

// users must be a sanitized array of usernames
proto.storePings = function(roomId, users, messageId){
	return this.execute(
		"insert into ping (room, player, message) select " +
		roomId + ", id, " + messageId +
		" from player where lower(name) in (" + users.map(n => "'"+n.toLowerCase()+"'").join(',') + ")",
		null,
		"store_pings", false
	);
}

// delete any ping
proto.deletePing = function(mid, userId){
	return this.execute(
		"delete from ping where message=$1 and player=$2",
		[mid, userId],
		"delete_message_user_ping"
	);
}

proto.deleteRoomPings = function(roomId, userId){
	return this.execute(
		"delete from ping where room=$1 and player=$2",
		[roomId, userId],
		"delete_room_user_pings"
	);
}

proto.deleteRoomsPings = function(roomIds, userId){
	if (roomIds.length===1) return this.deleteRoomPings(roomIds[0], userId);
	return this.execute(
		"delete from ping where room in ("+roomIds.join(',')+") and player=$1",
		[userId],
		"delete_rooms_pings", false
	);
}

proto.deleteLastRoomPings = function(roomId, userId, messageId){
	return this.execute(
		"delete from ping where room=$1 and player=$2 and message>=$3",
		[roomId, userId, messageId],
		"delete_last_room_pings"
	);
}

proto.deleteAllUserPings = function(userId){
	return this.execute(
		"delete from ping where player=$1",
		[userId],
		"delete_all_user_pings"
	);
}

proto.fetchUserPings = function(userId, after){
	var	sql = "select message.room r, room.name rname, player.name authorname, ping.message mid, content from ping"+
		" inner join message on message=message.id"+
		" inner join player on author=player.id"+
		" inner join room on room.id=ping.room"+
		" where player=$1",
		args = [userId],
		name = "user_pings";
	if (after) {
		sql += " and ping.message>$2";
		args.push(after);
		name += "_after";
	}
	return this.queryRows(sql, args, name);
}

// returns the id and name of the rooms where the user has been pinged
proto.fetchUserPingRooms = function(userId){
	return this.queryRows(
		"select room, max(name) as roomname from ping, room"+
		" where player=$1 and room.id=ping.room group by room",
		[userId],
		"user_ping_rooms"
	);
}

//////////////////////////////////////////////// #votes

proto.addVote = function(roomId, userId, messageId, level){
	var sql, args;
	switch (level) {
	case 'pin': case 'star': case 'up': case 'down':
		sql = "insert into message_vote (message, player, vote) select $1, $2, $3";
		sql += " where exists(select * from message where id=$1 and room=$4)"; // security check
		args = [messageId, userId, level, roomId];
		break;
	default:
		throw new Error('Unknown vote level');
	}
	return this.queryOptionalRow(
		sql,
		args,
		"add_vote"
	)
	.then(function(nb){
		if (nb) return this.updateGetMessage(messageId, level+"="+level+"+"+nb, userId);
	});
}

proto.removeVote = function(roomId, userId, messageId, level){
	return this.execute(
		"delete from message_vote where message=$1 and player=$2 and vote=$3",
		[messageId, userId, level],
		"delete_vote"
	)
	.then(function(res){
		if (res.rowCount) {
			return this.updateGetMessage(messageId, level+"="+level+"-1", userId);
		}
	});
}

// the administrative unpin removes all pins. Pins of other users are converted to stars (except the message's author).
proto.unpin = function(roomId, userId, messageId){
	return this.queryRow(
		"update message_vote set vote='star' where message=$1 and player!=$2 and vote='pin'" +
		" and exists(select * from message where id=$1 and room=$3 and author!=player)",
		[messageId, userId, roomId],
		"unpin_message"
	).then(function(nbconversions){
		return [
			nbconversions,
			this.queryRow(
				"delete from message_vote where message=$1 and vote='pin'",
				[messageId],
				"remove_pin_vote"
			)
		];
	}).spread(function(nbconversions){
		var expr = "pin=0";
		if (nbconversions) expr += ",star=star+"+nbconversions;
		return this.updateGetMessage(messageId, expr, userId);
	})
}

//////////////////////////////////////////////// #plugin

proto.storePlayerPluginInfo = function(plugin, userId, info){
	return this.queryRow(
		"insert into plugin_player_info (plugin, player, info) values($1, $2, $3)",
		[plugin, userId, info],
		"store_player_plugin_info"
	);
}

proto.getPlayerPluginInfo = function(plugin, userId){
	return this.queryOptionalRow(
		"select * from plugin_player_info where plugin=$1 and player=$2",
		[plugin, userId],
		"player_plugin_info"
	);
}

proto.deletePlayerPluginInfo = function(plugin, userId){
	return this.queryRow(
		"delete from plugin_player_info where plugin=$1 and player=$2",
		[plugin, userId],
		"delete_player_plugin_info"
	);
}

//////////////////////////////////////////////// #patches & versions

proto.getComponentVersion = function(component){
	return this.queryOptionalRow(
		"select version from db_version where component=$1",
		[component],
		"component_version", false
	)
	.then(function(row){
		return row ? row.version : 0;
	});
}

// applies the not yet applied patches for a component. This is automatically called
//  for the core of miaou but it may also be called by plugins (including for
//  initial installation of the plugin)
exports.upgrade = function(component, patchSubDirectory, cb){
	let	patchDirectory = path.resolve(__dirname, '..', patchSubDirectory),
		startVersion,
		endVersion;
	var p = on(component)
	.then(proto.getComponentVersion)
	.then(version => {
		console.log('Component '+component+' : current version='+version);
		startVersion = version;
	})
	.then(()=>fs.readdirAsync(patchDirectory))
	.then(names =>
		names.map(name => {
			var m = name.match(/^(\d+)-(.*).sql$/);
			return m ? { name:m[2], num:+m[1], filename:name } : null;
		})
		.filter(p => p && p.num>startVersion)
		.sort((a, b) => a.num-b.num)
	)
	.then(function(patches){
		if (!patches.length) return console.log('Component '+component+' is up to date.');
		endVersion = patches[patches.length-1].num;
		console.log('Component '+component+' must be upgraded from version '+startVersion+' to '+endVersion);
		return Promise.cast(patches).bind(this)
		.then(proto.begin)
		.reduce(function(_, patch){
			console.log('Applying patch '+patch.num+' : '+patch.name);
			return Promise.cast(patchDirectory+'/'+patch.filename).bind(this)
			.then(fs.readFileAsync.bind(fs))
			.then(buffer =>
				buffer.toString()
				.replace(/(#[^\n]*)?\n/g, ' ').split(';')
				.map(s => s.trim()).filter(Boolean)
			).map(function(statement){
				console.log(' Next statement :', statement);
				return this.execute(statement)
			});
		}, 'see https://github.com/petkaantonov/bluebird/issues/70')
		.then(function(){
			return this.execute("delete from db_version where component=$1", [component], "delete db_version", false)
		})
		.then(function(){
			return this.execute(
				"insert into db_version (component,version) values($1,$2)",
				[component, endVersion],
				"insert_db_version", false
			)
		})
		.then(proto.commit)
		.then(function(){
			console.log('Component '+component+' successfully upgraded to version '+endVersion)
		})
		.catch(function(err){
			console.log('An error prevented DB upgrade : ', err);
			console.log('All changes are rollbacked');
			return this.rollback();
		});
	})
	.finally(proto.off);
	if (cb) p.then(cb);
}

//////////////////////////////////////////////// #global API

function now(){
	return Date.now()/1000|0;
}

function logQuery(sql, args){ // used in debug
	console.log(sql.replace(/\$(\d+)/g, function(_, i){
		var s=args[i-1];
		return typeof s==="string" ? "'"+s+"'" : s
	}));
}

// concatenate the conditions to the base query, ensuring the proper numbering
// of ps arguments (psql needs a dense numbering)
// while allowing repetitions
var ps = exports.ps = function(sql, conditions, postConditions){
	var nn = 0;
	conditions = conditions.map(s=>{
		var n = 0;
		s = s.replace(/\$(\d+)/g, (_, d)=>{
			if (d>n) n = +d;
			return "$"+(+d+nn);
		});
		nn += n;
		return s;
	});
	if (conditions.length) {
		sql += " where " + conditions.map(c=>"("+c+")").join(" and ");
	}
	if (postConditions) sql += " " + postConditions.replace(/\$(\d+)/g, (_, d)=>"$"+(+d+nn));
	return sql;
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
	pg.defaults.parseInt8 = true;
	pool = new pg.Pool(config.database);
	pool.connect()
	.then(function(client){
		console.log('Connection to PostgreSQL database successful');
		exports.upgrade('core', 'sql/patches', cb);
	})
	.catch(function(err){
		console.log('Connection to PostgreSQL database failed');
		console.log(err);
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

// Queries the database. Returns a promise resolved with an array [rows, res]
// Arguments:
// * sql: the SQL query, with $x placeholders
// * args: an array of arguments, in order of placeholder numbers
// * name: both for the named prepared statement and perf logging
// * useANamedPreparedStatement: specifies whether a named prepared statement is to
//     be used
//     - true: always use one
//     - false: never use one (this MUST be the case if the sql isn't constant for that name
//     - undefined: unspecified (right now it means it's random)
proto._query = function(sql, args, name, useANamedPreparedStatement){
	var	opts = { text: sql };
	if (args) {
		opts.values = args;
		if (!args.map) {
			console.log("bad arguments");
			console.log('sql:', sql);
			console.log('args:', args);
		}
	}
	nbQueries++;
	if (!name) {
		useANamedPreparedStatement = false;
		name = "anonym query";
		if (arguments.length>1) {
			console.log("MISSING NAME IN QUERY");
			logQuery(sql, args);
		}
	}
	if (useANamedPreparedStatement === undefined) {
		useANamedPreparedStatement = !(nbQueries%2);
	}
	if (useANamedPreparedStatement) {
		opts.name = name;
		name += " (named)";
	}
	var	bo = bench.start("db / " + name);
	return new Promise((resolve, reject)=>{
		this.client.query(opts, function(err, res){
			var duration = bo.end() * .001;
			if (duration>100) {
				console.log("Slow query", name, "(" + duration + " ms)");
				logQuery(sql, args);
			}
			if (err) {
				console.log("DB query error in " + name);
				console.log(err.message);
				logQuery(sql, args);
				reject(err);
			} else {
				resolve([res.rows, res]);
			}
		});
	}).bind(this);
}

proto.queryRows = function(sql, args, name, useANamedPreparedStatement){
	return this._query(sql, args, name, useANamedPreparedStatement)
	.spread((rows, res) => rows);
}

proto.execute = function(sql, args, name, useANamedPreparedStatement){
	return this._query(sql, args, name, useANamedPreparedStatement)
	.spread((rows, res) => res);
}

proto.queryOptionalRow = function(sql, args, name, useANamedPreparedStatement){
	return this._query(sql, args, name, useANamedPreparedStatement)
	.spread((rows, res) => {
		if (rows.length) {
			return rows[0];
		} else if (res.rowCount) {
			return res.rowCount;
		} else {
			return null;
		}
	});
}

// throws a NoRowError if no row was found (select) or affected (insert, delete, update)
proto.queryRow = function(sql, args, name, useANamedPreparedStatement){
	return this._query(sql, args, name, useANamedPreparedStatement)
	.spread((rows, res) => {
		if (rows.length) {
			return rows[0];
		} else if (res.rowCount) {
			return res.rowCount;
		} else {
			throw new NoRowError();
		}
	});
}

// exemple : upsert('pref', 'value', 'normal', 'player', 3, 'name', 'notif')
// This code will be removed as soon as postgresql 9.5 is available...
proto.upsert = function(table, changedColumn, newValue, conditions){
	let	resolver = Promise.defer(),
		sql = "update "+table+" set "+changedColumn+"=$1",
		args = [newValue],
		colnames = [changedColumn],
		nbConditions = (arguments.length-3)>>1;
	for (var i=0; i<nbConditions; i++) {
		colnames.push(arguments[i*2+3]);
		sql += (i ? " and " : " where ") + arguments[i*2+3] + "=$"+(i+2)
		args.push(arguments[i*2+4]);
	}
	this.client.query(sql, args, (err, res)=>{
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
		for (var i=0; i<nbConditions; i++) {
			valnums.push('$'+(i+2));
		}
		sql = "insert into "+table+"("+colnames.join(',')+") values("+valnums.join(',')+")";
		this.client.query(sql, args, function(err, res){
			if (err) {
				console.log('Error in query:');
				logQuery(sql, args);
				resolver.reject(err);
			} else {
				resolver.resolve();
			}
		});
	});
	return resolver.promise.bind(this);
}

proto.lookForPreparedStatement = function(psname){
	return this.queryRows("select name from pg_prepared_statements where name=$1", [psname])
	.then(function(rows){
		if (rows.length) console.log("PS", psname, "FOUND");
		else console.log("PS", psname, "NOT FOUND!");
	});
}

;['begin', 'rollback', 'commit'].forEach(function(s){
	proto[s] = function(arg){
		return this.execute(s)
		.then(function(){
			return arg
		})
	}
});

for (var fname in proto) {
	if (proto.hasOwnProperty(fname) && typeof proto[fname] === "function") {
		exports[fname] = proto[fname];
	}
}
