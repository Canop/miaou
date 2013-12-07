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
	con.client.query('select id, name, description from room where id=$1', [id], function(err, result){
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
	con.client.query('select id, name, description, auth from room left join room_auth a on a.room=room.id and a.player=$1 where room.id=$2', [userId, roomId], function(err, result){
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
		if (err) {
			con.nok(cb, err);
		} else {
			cb(null, result.rows);
		}
	});
}
Con.prototype.listUserRoomAuths = function(userId, cb){
	var con = this;
	con.client.query("select id, name, description, auth from room r, room_auth a where a.room=r.id and a.player=$1", [userId], function(err, result){
		if (err) {
			con.nok(cb, err);
		} else {
			cb(null, result.rows);
		}
	});
}

// returns a query with the most recent messages of the room
Con.prototype.queryLastMessages = function(roomId, N){
	return this.client.query(
		'select message.id, author, player.name as authorname, content, message.created as created, message.changed from message'+
		' left join player on author=player.id where room=$1 order by created desc',
		[roomId]
	);
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
