"use strict";

const auths = require('./auths.js'),
	server = require('./server.js');

var db;

exports.configure = function(miaou){
	db = miaou.db;
	return this;
}

// params : n, room
exports.appGetJsonLastMessages = function(req, res){
	var n = Math.min(+req.query.n||1, 20),
		roomId = +req.query.room;
	db.on([roomId, req.user.id])
	.spread(db.fetchRoomAndUserAuth)
	.then(function(room){
		if (!room) throw "room \""+roomId+"\" not found";
		if (room.private && !auths.checkAtLeast(room.auth, 'write')) {
			throw "unauthorized";
		}
		return this.getMessages(roomId, req.user.id, n, false);
	})
	.then(function(messages){
		res.json(
			{ messages:messages }
		);
	})
	.catch(function(err){
		res.json({error: err.toString()});
	})
	.finally(db.off);
}
