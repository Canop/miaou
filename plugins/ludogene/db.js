// returns a promise solved with messages, each of them
// containing a valid loaded game (g)
// con must be an open connection to the DB
exports.getGameMessages = function(con){
	return con.queryRows(
		"select message.id, room, content, created, changed from message join room on message.room=room.id"+
		" where room.private is false and content like '!!game %' order by message.id"
	)
	.map(function(m){
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
