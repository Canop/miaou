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


// returns a user found by its name, creates it if necessary
//   cb(err, user)
Con.prototype.fetchUser = function(name, cb){
	var con = this;
	con.client.query('select id from player where name=$1', [name], function(err, result){
		if (err) {
			con.nok(cb, err);
		} else if (result.rows.length) {
			cb(null, {id:result.rows[0].id, name:name})
		} else {
			con.client.query('insert into player (name) values ($1) returning id', [name], function(err, result){
				if (err) return con.nok(cb, err);
				cb(null, {id:result.rows[0].id, name:name})
			});
		}
	});
}

// returns an existing room found by its name
Con.prototype.fetchRoom = function(name, cb){
	var con = this;
	con.client.query('select id, name, description from room where name=$1', [name], function(err, result){
		if (err) {
			con.nok(cb, err);
		} else if (!result.rows.length) {
			cb(new Error('Room "'+name+'" not found'));
		} else {
			cb(null, result.rows[0]);
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
	console.dir(m);
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
	return this;
}
// cb(err, con)
exports.con = function(cb) {
	pg.connect(conString, function(err, client, done){
		if (err) cb(err);
		else cb(null, new Con(client, done));		
	});
}
