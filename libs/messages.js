const	auths = require('./auths.js'),
	ws = require("./ws.js");

var db;

exports.configure = function(miaou){
	db = miaou.db;
	return this;
}

// params : n, room
exports.appGetJsonLastMessages = function(req, res){
	if (!req.user) {
		res.json({error: "no connected user"});
		return;
	}
	let	n = Math.min(+req.query.n||1, 20),
		roomId = +req.query.room;
	db.on([roomId, req.user.id])
	.spread(db.fetchRoomAndUserAuth)
	.then(function(room){
		if (room.private && !auths.checkAtLeast(room.auth, 'write')) {
			throw "unauthorized";
		}
		return this.getMessages(roomId, req.user.id, n, false);
	})
	.map(m => ws.clean(m)) // remove !!deleted content, for example
	.then(function(messages){
		res.json({ messages });
		if (!messages.length) return;
		var oldestMessageId = messages[messages.length-1].id;
		return this.deleteLastRoomPings(roomId, req.user.id, oldestMessageId);
	})
	.catch(db.NoRowError, function(){
		var e = "no room found for id" + roomId;
		console.log(e);
		res.json({error: e});
	})
	.catch(function(err){
		console.log("error in appGetJsonLastMessages:", err);
		res.json({error: err.toString()});
	})
	.finally(db.off);
}
