const	auths = require('./auths.js');

var db;

exports.configure = function(miaou){
	db = miaou.db;
	return this;
}

// params : n, room
exports.appGetJsonLastMessages = function(req, res){
	if (!req.user) {
		console.log("no user in appGetJsonLastMessages");
		res.json({error: "no connected user"});
		return;
	}
	let	n = Math.min(+req.query.n||1, 20),
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
		res.json({ messages });
		var oldestMessageId = messages[messages.length-1].id;
		return this.deleteLastRoomPings(roomId, req.user.id, oldestMessageId);
	})
	.catch(function(err){
		console.log("error in appGetJsonLastMessages:", err);
		res.json({error: err.toString()});
	})
	.finally(db.off);
}
