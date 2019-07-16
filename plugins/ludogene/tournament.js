// functions to organize Tribo tournaments

const	titles = {
	list : '# Tournament Players:',
	start: '# Tournament Starts!',
	score: '# Tournament Score:',
	games: '# Tournament Games:',
	end  : '# Tournament Ends!'
};

const	ws = require('../../libs/ws.js'),
	fmt = require('../../libs/fmt.js'),
	ludo = require('./plugin.js');

const	removedPlayers = new Set(['Shaks', 'Andy_Kw']);

var	db,
	bot;

exports.init = function(miaou){
	db = miaou.db;
	bot = miaou.bot;
	return miaou.requestTag({
		name: "Tournament",
		description: "Rooms with this tag are dedicated to game tournaments"
	});
}

async function write(roomId, content){
	await ws.botMessage(bot, roomId, content);
}
function listPlayers(ct, gameType){
	var roomId = ct.shoe.room.id;
	db.on().then(function(){
		return this.queryRows(
			"select author id, (select name from player where player.id=author) from message"+
			" where star>0 and room=$1 and content not like '!!deleted%' group by author",
			[roomId],
			"ludogene / list players"
		);
	}).then(function(players){
		var lines = [];
		lines.push(titles.list);
		lines.push("id|name");
		lines.push(":-:|:-:");
		players.forEach(function(p){
			lines.push(p.id+'|'+p.name);
		});
		write(roomId, lines.join('\n'));
	}).finally(db.off);
}

// creates the games
function startTournament(ct, gameType){
	var roomId = ct.shoe.room.id;
	ct.shoe.checkAuth('own');
	return db.do(async function(con){
		// look for the players list
		let listMessage = await con.queryOptionalRow(
			"select content from message where room=$1 and author=$2"+
			" and content like '"+titles.list+"%'"+
			" order by id desc limit 1",
			[roomId, bot.id],
			"ludogene / find title message"
		);
		if (!listMessage) {
			return ct.reply(
				"You need a list of players."+
				" Use `!!" + gameType.toLowerCase() + " tournament list` to create one."
			);
		}
		let players = [];
		listMessage.content.split('\n').forEach(function(line){
			var match = line.match(/^(\d+)\|(\w[\w-]{2,19})$/);
			if (!match) return;
			players.push({id:+match[1], name:match[2]});
		});
		console.log("players:", players);
		if (players.length<2) {
			return ct.reply("At least 2 players are needed for a tournament");
		}
		await write(roomId, titles.start);
		for (var i=0; i<players.length; i++) {
			for (var j=0; j<players.length; j++) {
				if (i==j) continue;
				await ludo.startGame(roomId, gameType, [players[i], players[j]]);
			}
		}
	});
}

// context must be a db con
function getGames(roomId, gameType){
	return this.queryRow(
		"select id from message where room=$1 and author=$2"+
		" and content like '"+titles.start+"%'"+
		" order by id desc limit 1",
		[roomId, bot.id],
		"ludogene / fuzzy"
	)
	.then(function(tournamentStartMessage){
		return this.queryRows(
			"select message.id, content, changed from message"+
			" where room=$1 and id>$2 and content like '!!game %'",
			[roomId, tournamentStartMessage.id],
			"ludogene / tournament messages"
		);
	})
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
		return m && m.g && m.g.type===gameType
			&& !(removedPlayers.has(m.g.players[0].name) || removedPlayers.has(m.g.players[1].name));
	});
}

const specifics = {
	Tribo: {
		additionalColumns: [],
		// determines if the player won (for a finished game)
		isWinner(g, idx){
			return g.scores[idx] + idx/2 > 50;
		},
		// compute the gain of the (finished) game
		gain(g, idx, won){
			return g.scores[idx] + won * 3;
		}
	},
	Flore: {
		additionalColumns: [
			{name: "Killed Flowers", key: "sumScores"},
			{name: "Lost Flowers", key: "sumOpponentScores"},
		],
		isWinner(g, idx){
			return g.scores[idx] + idx/2 > g.scores[+!idx];
		},
		gain(g, idx, won){
			return 3*g.scores[idx] -2*g.scores[+!idx] + won * 5;
		}
	}
}

function writeScore(ct, gameType){
	var	roomId = ct.shoe.room.id;
	let now = Date.now()/1000|0;
	let specific = specifics[gameType];
	return db.on([roomId, gameType])
	.spread(getGames)
	.filter(function(m){
		return m.g.scores;
	})
	.reduce(function(map, m){
		m.g.players.forEach(function(p, i){
			var pm = map.get(p.id);
			if (!pm) {
				pm = p;
				pm.nbGames = 0;
				pm.nbDrops = 0; // unused now
				pm.nbWins = 0;
				pm.nbFinishedGames = 0;
				pm.sumScores = 0;
				pm.sumOpponentScores = 0;
				pm.sumGains = 0; // only counting finished games
				map.set(p.id, pm);
			}
			pm.nbGames++;
			if (m.g.status==='finished') {
				pm.nbFinishedGames++;
				let won = specific.isWinner(m.g, i);
				if (won) pm.nbWins++;
				pm.sumGains += specific.gain(m.g, i, won);
				pm.sumScores += m.g.scores[i];
				pm.sumOpponentScores += m.g.scores[+!i];
			}
			if (
				m.g.status === 'running'
				&& m.g.current === i
				&& m.changed < now - 30*60
			) pm.nbDrops++;
		});
		return map;
	}, new Map)
	.then(function(map){
		var players = Array.from(map.values());
		players = players.sort((a, b) => b.sumGains-a.sumGains);
		write(roomId, titles.score + "\n" + fmt.tbl({
			rank: true,
			cols: [
				'Player',
				'Finished',
				'Drops',
				'Wins',
				...specific.additionalColumns.map(c=>c.name),
				'Mean Gain',
				'Score'
			],
			rows: players.map(function(p, i){
				var	meanGain = p.sumGains / p.nbFinishedGames;
				return [
					"["+p.name+"](u/"+p.id+")",
					p.nbFinishedGames,
					p.nbDrops || " ",
					p.nbWins || " ",
					...specific.additionalColumns.map(c=>p[c.key]||" "),
					meanGain ? meanGain.toFixed(1) : ' ',
					p.sumGains
				];
			})
		}));
	})
	.catch(db.NoRowError, function(){
		ct.reply("Tournament not started");
	})
	.finally(db.off);
}

function listGames(ct, gameType){
	let roomId = ct.shoe.room.id;
	let specific = specifics[gameType];
	return db.on([roomId, gameType])
	.spread(getGames)
	.then(function(messages){
		var lines = [titles.games];
		lines.push('Player 1|Player 2|Result|Player 1 Gain|Player 2 Gain');
		lines.push(lines[lines.length-1].replace(/[^|]+/g, ':-:'));
		messages.forEach(function(m){
			var g = m.g;
			var r;
			if (g.status==='finished') {
				r = g.players[0].name+'('+g.scores[0]+') - '+ g.players[1].name+'('+g.scores[1]+')';
			} else {
				r = 'Waiting for **'+g.players[g.current||0].name+'**';
			}
			let cells = [
				g.players[0].name,
				g.players[1].name,
				"["+r+"](#"+m.id+")"
			];
			if (g.status == "finished") {
				cells.push(specific.gain(g, 0, specific.isWinner(g, 0)));
				cells.push(specific.gain(g, 1, specific.isWinner(g, 1)));
			} else {
				cells.push(" ", " ");
			}
			lines.push(cells.join('|'));
		});
		write(roomId, lines.join('\n'));
	})
	.finally(db.off);
}


exports.handle = function(ct, gameType){
	if (/\blist\b/i.test(ct.args)) return listPlayers.call(this, ct, gameType);
	if (/\bstart\b/i.test(ct.args)) return startTournament.call(this, ct, gameType);
	if (/\bgames\b/i.test(ct.args)) return listGames.call(this, ct, gameType);
	return writeScore.call(this, ct, gameType);
}
