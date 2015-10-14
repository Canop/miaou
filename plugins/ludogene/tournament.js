// functions to organize Tribo tournaments

const	titles = {
	list : '# Tournament Players:',
	start: '# Tournament Starts!',
	score: '# Tournament Score:',
	end  : '# Tournament Ends!'
};

const	ws = require('../../libs/ws.js'),
	ludo = require('./plugin.js');

var	db,
	bot;

exports.init = function(miaou){
	db = miaou.db;
	bot = miaou.bot;
}

function listPlayers(ct, gameType){
	db.on().then(function(){
		return this.queryRows(
			"select author id, (select name from player where player.id=author) from message"+
			" where star>0 and room=$1 and content not like '!!deleted%' group by author",
			[ct.shoe.room.id]
		);
	}).then(function(players){
		var lines = [];
		lines.push(titles.list);
		lines.push("id|name");
		lines.push(":-:|:-:");
		players.forEach(function(p){
			lines.push(p.id+'|'+p.name);
		});
		ws.botMessage(bot, ct.shoe.room.id, lines.join('\n'));
	}).finally(db.off);
}

// creates the games
function startTournament(ct, gameType){
	var roomId = ct.shoe.room.id;
	ct.shoe.checkAuth('own');
	db.on().then(function(){
		return this.queryRow(
			"select content from message where room=$1 and author=$2"+
			" and content like '"+titles.list+"%'"+
			" order by id desc limit 1",
			[roomId, bot.id]
		);
	}).then(function(m){
		console.log(m);
		var players = [];
		m.content.split('\n').forEach(function(line){
			var match = line.match(/^(\d+)\|(\w[\w-]{2,19})$/);
			if (!match) return;
			players.push({id:+match[1], name:match[2]});
		});
		console.log("players:", players);
		if (players.length<2) {
			return ct.reply("At least 2 players are needed for a tournament");
		}
		ws.botMessage(bot, roomId, titles.start);
		for (var i=0; i<players.length; i++) {
			for (var j=0; j<players.length; j++) {
				if (i==j) continue;
				ludo.startGame(roomId, gameType, [players[i], players[j]]);
			}
		}
	}).catch(db.NoRowError, function(){
		ct.reply("You need a list of players. Use `!!tribo tournament list` to create one.");
	}).finally(db.off);
}

function writeScore(ct, gameType){
	var	roomId = ct.shoe.room.id;
	db.on().then(function(){
		return this.queryRow(
			"select id from message where room=$1 and author=$2"+
			" and content like '"+titles.start+"%'"+
			" order by id desc limit 1",
			[roomId, bot.id]
		);
	})
	.then(function(tournamentStartMessage){
		return this.queryRows(
			"select message.id, content, changed from message"+
			" where room=$1 and id>$2 and content like '!!game %'",
			[roomId, tournamentStartMessage.id]
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
		return m && m.g && m.g.status!=='ask' && m.g.type===gameType;
	})
	.reduce(function(map, m){
		console.log("game:", m.g);
		m.g.players.forEach(function(p,i){
			var pm = map.get(p.id);
			if (!pm) {
				pm = p;
				pm.nbGames = 0;
				pm.sumScores = 0;
				pm.nbDrops = 0;
				pm.nbWins = 0;
				pm.nbFinishedGames = 0;
				map.set(p.id, pm);
			}
			pm.nbGames++;
			pm.sumScores += m.g.scores[i];
			if (m.g.scores[i]+i/2>50) pm.nbWins++;
			if (m.g.status==='finished') pm.nbFinishedGames++;
			if (
				m.g.status === 'running'
				&& m.g.current === i
				&& m.changed < Date.now()/1000 - 30*60
			) pm.nbDrops++;
		});
		return map;
	}, new Map)
	.then(function(map){
		var players = [];
		map.forEach(function(p){
			p.twcScore = 3*p.nbWins + p.sumScores -10*p.nbDrops;
			players.push(p);
		});
		players = players.sort(function(a,b){ return b.twcScore-a.twcScore });
		var lines = [titles.score];
		lines.push('Rank|Player|Finished Games|Wins|Drops|Mean Score|TWC Score');
		lines.push(lines[lines.length-1].replace(/[^|]+/g,':-:'));
		[].push.apply(lines, players.map(function(p,i){
			return [
				"**"+(i+1)+"**",
				"["+p.name+"](u/"+p.id+")",
				p.nbFinishedGames,
				p.nbWins,
				p.nbDrops,
				(p.sumScores/p.nbGames).toFixed(1),
				p.twcScore
			].join('|');
		}));
		ws.botMessage(bot, roomId, lines.join('\n'));
	})
	.catch(db.NoRowError, function(){
		ct.reply("Tournament not started");
	})
	.finally(db.off);
}

exports.handle = function(ct, gameType){
	var	p = ct.shoe.publicUser;
	if (/\blist\b/i.test(ct.args)) return listPlayers.call(this, ct, gameType);
	if (/\bstart\b/i.test(ct.args)) return startTournament.call(this, ct, gameType);
	if (/\bgames\b/i.test(ct.args)) return listGames.call(this, ct, gameType);
	return writeScore.call(this, ct, gameType);
}
