const	bench = require('../../libs/bench.js'),
	ludodb = require('./db.js');

let	noLadderRooms; // public rooms from which we don't want games for the ladder

exports.init = function(miaou, _gametypes){
	noLadderRooms = miaou.conf("pluginConfig", "ludogene", "noLadderRooms") || [];
}

function link(m, s){
	return '\n* ['+s+']('+m.room+'#'+m.id+')';
}

// called when a user just typed !!tribo (or another game)
// context of the call must be an open connection
exports.doCommand = function(ct, gameType){
	let	ln = gameType.toLowerCase(),
		c = 'To invite somebody to a game of '+gameType+' type\n`!!'+ln+' @someUser`',
		p = ct.shoe.publicUser,
		bo = bench.start(gameType+" / suggest"),
		noLadderRoom = noLadderRooms.includes(ct.shoe.room.id),
		local = noLadderRoom || ct.shoe.room.private || /\[tournament\]/i.test(ct.shoe.room.description);
	return ludodb.getGameMessages(this,  local ? ct.shoe.room.id : 0)
	.filter(function(m){
		if (
			m.g.type!==gameType
			|| m.g.status==="finished"
			|| m.g.status==="refused"
			|| !(m.g.players[0].name===p.name || m.g.players[1].id===p.id)
		) return false;
		if (!noLadderRoom && noLadderRooms.includes(m.room)) return false;
		return true;
	})
	.then(function(messages){
		if (local) {
			c += '\n## Pending Games in this room:';
		} else {
			c += '\n## Pending Games:';
		}
		if (messages.length) {
			messages.reverse().forEach(function(m){
				if (m.g.status==="ask") {
					if (m.g.players[0].name===p.name) {
						c += link(m, '@'+m.g.players[1].name+' is waiting for **your** accept');
					} else {
						c += link(m, 'waiting for @' + m.g.players[0].name+' to accept');
					}
				} else if (m.g.current===0 || m.g.current===1) {
					if (m.g.players[m.g.current].name===p.name) {
						let name = m.g.players[+!m.g.current].name;
						c += link(m, "It's **your** turn to play against @"+name);
					} else {
						let name = m.g.players[m.g.current].name;
						c += link(m, "It's @"+name+"'s turn to play");
					}
				} else {
					console.log("strange game state. mid:", m.id);
				}
			});
		} else {
			c += '\n*none*';
		}
		bo.end();
		ct.reply(c, ct.nostore=true);
	});
}
