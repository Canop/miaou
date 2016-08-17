// the attention plugin makes it possible for room admin to
// bring attention to pinned messages
// Note that the room parameter in some queries is a security
// measure preventing a user to see in other rooms

const	path = require('path');
var	db;

exports.name = "attention";

exports.init = function(miaou){
	db = miaou.db;
	db.upgrade(exports.name, path.resolve(__dirname, 'sql'));
}

function addAlert(roomId, messageId, userId){
	return this.execute(
		"insert into attention_alert (message, room, creator)"+
		" select id, room, $3 from message where id=$1 and room=$2",
		[messageId, roomId, userId],
		"attention / add_alert"
	)
}

function acknowledgeAlert(messageId, userId){
	return this.execute(
		"insert into attention_seen (message, player) values ($1,$2)",
		[messageId, userId],
		"attention / ack_alert"
	)
}
function removeAlert(roomId, messageId){
	return this.execute(
		"delete from attention_alert where room=$1 and message=$2",
		[roomId, messageId],
		"attention / delete_alert"
	).then(function(res){
		if (!res.rowCount) throw "no alert to remove";
		return this.execute(
			"delete from attention_seen where message=$1",
			[messageId],
			"attention / delete_alert_seen"
		);
	});
}
function getAlert(messageId, userId){
	return this.queryOptionalRow(
		"select a.message, a.creator, a.room, s.player as seen"+
		" from attention_alert a left join attention_seen s on a.message=s.message"+
		" where a.message=$1",
		[messageId],
		"attention / get_alert"
	);
}
exports.onNewShoe = function(shoe){
	shoe.socket
	.on('attention.alert', function(mid){
		shoe.checkAuth('admin');
		db.on([shoe.room.id, +mid, shoe.publicUser.id])
		.spread(addAlert)
		.then(function(){
			shoe.emitToRoom('attention.alert', {message:mid, creator:shoe.publicUser.id});
		})
		.catch(e => console.log("error in attention.alert handling:", e) )
		.finally(db.off);
	})
	.on('attention.ok', function(mid){
		db.on([+mid, shoe.publicUser.id])
		.spread(acknowledgeAlert)
		.catch(e => console.log("error in attention.ok handling:", e) )
		.finally(db.off);
	})
	.on('attention.remove', function(mid){
		shoe.checkAuth('admin');
		db.on([shoe.room.id, +mid])
		.spread(removeAlert)
		.then(function(){
			// todo check we removed something (security)
			shoe.emitToRoom('attention.remove', mid);
		})
		.catch(e => console.log("error in attention.remove handling:", e) )
		.finally(db.off);
	})
	.on('attention.query', function(mid){
		db.on([+mid])
		.spread(getAlert)
		.then(function(alert){
			if (alert) shoe.emitToRoom('attention.alert', alert);
		})
		.catch(e => console.log("error in getAlert handling:", e) )
		.finally(db.off);
	})
}
