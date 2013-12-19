// postgresql persistence

var pg = require('pg').native,
	conString;

function Con(client, done) {
	this.client = client;
	this.ok = done;
}
Con.prototype.nok = function(cb, err){
	this.ok();
	cb(err);
}

// returns a user found by the Google OAuth profile, creates it if it doesn't exist
// Private fields are included in the returned object
Con.prototype.fetchCompleteUserFromOAuthProfile = function(profile, cb){
	var con = this, email = profile.emails[0].value, returnedCols = 'id, name, oauthdisplayname, email';
	con.client.query('select '+returnedCols+' from player where email=$1', [email], function(err, result){
		if (err) {
			con.nok(cb, err);
		} else if (result.rows.length) {
			cb(null, result.rows[0]);
		} else {
			con.client.query(
				'insert into player (oauthid, oauthprovider, email, oauthdisplayname) values ($1, $2, $3, $4) returning '+returnedCols,
				[profile.id, profile.provider, email, profile.displayName],
				function(err, result)
			{
				if (err) return con.nok(cb, err);
				cb(null, result.rows[0])
			});
		}
	});
}

// returns an existing user found by his id
// Only public fields are returned
// Private fields are included in the returned object
Con.prototype.fetchUserById = function(id, cb){
	var con = this;
	con.client.query('select id, name, oauthdisplayname, email from player where id=$1', [id], function(err, result){
		if (err) {
			con.nok(cb, err);
		} else if (!result.rows.length) {
			cb(new Error('Player "'+id+'" not found'));
		} else {
			cb(null, result.rows[0]);
		}
	});
}

// right now it only updates the name, I'll enrich it if the need arises
Con.prototype.updateUser = function(user, cb){
	var con = this;
	con.client.query('update player set name=$1 where id=$2', [user.name, user.id], function(err, result){
		if (err) con.nok(cb, err);
		else cb();
	});
}

// returns an existing room found by its id
Con.prototype.fetchRoom = function(id, cb){
	var con = this;
	con.client.query('select id, name, description, private from room where id=$1', [id], function(err, result){
		if (err) {
			con.nok(cb, err);
		} else if (!result.rows.length) {
			cb(new Error('Room "'+id+'" not found'));
		} else {
			cb(null, result.rows[0]);
		}
	});
}

// returns an existing room found by its id and the user's auth level
Con.prototype.fetchRoomAndUserAuth = function(roomId, userId, cb){
	var con = this;
	con.client.query('select id, name, description, private, auth from room left join room_auth a on a.room=room.id and a.player=$1 where room.id=$2', [userId, roomId], function(err, result){
		if (err) {
			con.nok(cb, err);
		} else if (!result.rows.length) {
			cb(new Error('Room "'+roomId+'" not found'));
		} else {
			cb(null, result.rows[0]);
		}
	});
}

// gives to cb an array of all public rooms
Con.prototype.listPublicRooms = function(cb){
	var con = this;
	con.client.query('select id, name, description from room where private is not true', function(err, result){
		if (err) con.nok(cb, err);
		else cb(null, result.rows);
	});
}
// lists the authorizations a user has
Con.prototype.listUserAuths = function(userId, cb){
	var con = this;
	con.client.query("select id, name, description, auth from room r, room_auth a where a.room=r.id and a.player=$1", [userId], function(err, result){
		if (err) con.nok(cb, err);
		else cb(null, result.rows);
	});
}
// lists the authorizations of the room
Con.prototype.listRoomAuths = function(roomId, cb){
	var con = this;
	con.client.query("select id, name, auth, player, granter, granted from player p, room_auth a where a.player=p.id and a.room=$1 order by auth desc, name", [roomId], function(err, result){
		if (err) con.nok(cb, err);
		else cb(null, result.rows);
	});
}

// lists the 
Con.prototype.listAccessibleRooms = function(userId, cb){
	var con = this;
	con.client.query("select id, name, description, private, auth from room r left join room_auth a on a.room=r.id and a.player=$1 where private is false or auth is not null order by auth desc nulls last, name", [userId], function(err, result){
		if (err) con.nok(cb, err);
		else cb(null, result.rows);
	});
}

Con.prototype.insertAccessRequest = function(roomId, userId, cb){
	var con = this;
	con.client.query('delete from access_request where room=$1 and player=$2', [roomId, userId], function(err, result){
		if (err) return con.nok(cb, err);
		con.client.query(
			'insert into access_request (room, player, requested) values ($1, $2, $3) returning *',
			[roomId, userId, ~~(Date.now()/1000)],
			function(err, result)
		{
			if (err) return con.nok(cb, err);
			cb(null, result.rows[0]);
		});
	});
}

// userId : optionnal
Con.prototype.listOpenAccessRequests = function(roomId, userId, cb){
	var sql = "select player,name,requested from player p,access_request r where r.player=p.id and room=$1",
		con = this, args = [roomId];		
	if (typeof userId === "function") {
		cb = userId;
	} else {
		sql += " and player=?";
		args.push(userId);
	}
	con.client.query(sql, args, function(err, result){
		if (err) return con.nok(cb, err);
		cb(null, result.rows);
	});	
}

// returns a query with the most recent messages of the room
Con.prototype.queryLastMessages = function(roomId, N){
	return this.client.query(
		'select message.id, author, player.name as authorname, content, message.created as created, message.changed from message'+
		' left join player on author=player.id where room=$1 order by created desc limit $2',
		[roomId, N]
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
	var con = this;
	con.client.query("delete from ping where room=$1 and player=$2", [roomId, userId], function(err){
		if (err) return con.nok(cb, err);
		cb(null);
	});
}

Con.prototype.fetchUserPings = function(userId, cb) {
	var con = this;
	con.client.query("select player, room, name, message from ping, room where player=$1 and room.id=ping.room", [userId], function(err, res){
		if (err) return con.nok(cb, err);
		cb(null, res.rows);
	});
}

// returns the id and name of the rooms where the user has been pinged
Con.prototype.fetchUserPingRooms = function(userId, cb) {
	var con = this;
	con.client.query("select distinct(room), name from ping, room where player=$1 and room.id=ping.room", [userId], function(err, res){
		if (err) return con.nok(cb, err);
		cb(null, res.rows);
	});

}

Con.prototype.storeRoom = function(r, author, cb) {
	var con = this, now = ~~(Date.now()/1000);
	if (r.id) {
		con.checkAuthLevel(r.id, author.id, 'admin', function(err, auth){
			if (err) return con.nok(cb, err);
			if (auth) {
				con.client.query(
					'update room set name=$1, private=$2, description=$3 where id=$4',
					[r.name, r.private, r.description||'', r.id],
					function(err, result)
				{
					if (err) return con.nok(cb, err);
					cb(null, r);
				});				
			} else {
				cb(new Error("Admin right is needed to change the room"));
			}
		});
	} else {
		con.client.query(
			'insert into room (name, private, description) values ($1, $2, $3) returning id',
			[r.name, r.private, r.description||''],
			function(err, result)
		{
			if (err) return con.nok(cb, err);
			r.id = result.rows[0].id;
			con.client.query(
				'insert into room_auth (room, player, auth, granted) values ($1, $2, $3, $4)',
				[r.id, author.id, 'own', now],
				function(err, result)
			{
				if (err) return con.nok(cb, err);
				cb(null, r);
			});
		});		
	}
}

exports.init = function(dbConfig){
	conString = dbConfig.url;
	pg.defaults.parseInt8 = true;
	return this;
}
// cb(err, con)
exports.con = function(cb) {
	pg.connect(conString, function(err, client, done){
		if (err) cb(err);
		else cb(null, new Con(client, done));		
	});
}
