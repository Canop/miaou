"use strict";

const auths = require('./auths.js'),
	server = require('./server.js');

// params : n, room
exports.appGetJsonLastMessages = function(req, res, db){
	var n = Math.min(+req.param('n')||1, 20),
		roomId = +req.param('room');
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
