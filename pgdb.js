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

// gives to cb an array of all public rooms
Con.prototype.listPublicRooms = function(cb){
	var con = this;
	con.client.query('select id, name, description from room', function(err, result){
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

// stores a message and sets its id
Con.prototype.storeMessage = function(m, cb){
	var con = this;
	con.client.query(
		'insert into message (room, author, content, created) values ($1, $2, $3, $4) returning id',
		[m.room, m.author, m.content, m.created],
		function(err, result)
	{
		if (err) return con.nok(cb, err);
		m.id = result.rows[0].id;
		cb(null, m)
	});
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
