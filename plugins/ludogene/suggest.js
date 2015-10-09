const ludodb = require('./db.js');

function link(m, s){
	return '\n* ['+s+']('+m.room+'#'+m.id+')';
}

// called when a user just typed !!tribo (or another game)
// context of the call must be an open connection
module.exports = function(ct, gameType){
	var	p = ct.shoe.publicUser;
	return ludodb.getGameMessages(this)
	.filter(function(m){
		return	m.g.type===gameType && m.g.status!=="finished"
			&& (m.g.players[0].name===p.name || m.g.players[1].id===p.id);
	})
	.then(function(messages){
		var	c = 'To invite somebody to a game of '+gameType+' type\n'+
		       	'`!!'+gameType.toLowerCase()+' @someUser`';
		if (messages.length) {
			c += '\n## Pending Games:';
			messages.reverse().forEach(function(m){
				if (m.g.status==="ask") {
					if (m.g.players[0].name===p.name) {
						c += link(m, '@'+m.g.players[1].name+' is waiting for **your** accept');
					} else {
						c += link(m, 'waiting for @' + m.g.players[0].name+' to accept');
					}
				} else if (m.g.current===0 || m.g.current===1){
					if (m.g.players[m.g.current].name===p.name) {
						c += link(m, "It's **your** turn to play against @"+m.g.players[+!m.g.current].name);
					} else {
						c += link(m, "It's @"+m.g.players[m.g.current].name+"'s turn to play");
					}
				} else {
					console.log("strange game state. mid:", m.id);
				}
			});
		}
		ct.reply(c, ct.nostore=true);
	});
}
