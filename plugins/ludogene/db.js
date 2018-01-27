// returns a promise solved with messages, each of them
// containing a valid loaded game (g)
// con must be an open connection to the DB
// roomId is optional (if not provided, all public rooms are searched)
exports.getGameMessages = function(con, roomId){
	var query;
	if (roomId) {
		query = con.queryRows(
			"select message.id, room, content, created, changed"+
			" from message join room on message.room=room.id"+
			" where room=$1 and content like '!!game %' order by message.id",
			[roomId],
			"ludogene / room_game_messages"
		);
	} else {
		query = con.queryRows(
			"select message.id, room, content, created, changed"+
			" from message join room on message.room=room.id"+
			" where room.private is false and content like '!!game %' order by message.id",
			[],
			"ludogene / game_messages"
		);
	}
	return query.map(function(m){
		try {
			m.g = JSON.parse(m.content.match(/{.*$/)[0]);
			return m;
		} catch (e) {
			console.log('invalid game message id='+m.id);
			return null;
		}
	})
	.filter(function(m){
		return m && m.g;
	});
}

exports.cleanOldInvitations = function(db, age){
	db.on().then(function(){
		return this.execute(
			"update message set content = replace(content, '\"ask\"', '\"refused\"')"
			+ " where content ~ '!!game @\\w[\\w-]{2,19} \\{\"type\":\"\\w+\",\"status\":\"ask\"'"
			+ " and created<$1",
			[(Date.now()/1000-age)|0],
			"ludogene / auto_decline"
		);
	}).then(function(res){
		console.log("Removed", res.rowCount, "old invitation(s)");
	}).finally(db.off);
}

exports.cleanOldForgottenGames = function(db, age){
	db.on().then(function(){
		return this.execute(
			`update message set content = replace(content, '"running"', '"refused"') where content `
			+ `~ '!!game @\\w[\\w-]{2,19} \\{"type":"\\w+","status":"running".*moves":"[^"]{0,3}"\\}$'`
			+ " and created<$1",
			[(Date.now()/1000-age)|0],
			"ludogene / auto_end_forgotten"
		);
	}).then(function(res){
		console.log("Removed", res.rowCount, "old forgotten game(s)");
	}).finally(db.off);
}
