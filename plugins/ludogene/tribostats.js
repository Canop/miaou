function playersInfos(messages, f, authorizedplayers){
	var playersmap = {}, players = [];
	messages.forEach(function(m){
		var	p = [], g = m.g;
		if (!g.scores) return;
		for (var i=0; i<2; i++) {
			if (authorizedplayers && !authorizedplayers.has(g.players[i].id)) return;
			p[i] = playersmap[g.players[i].id];
			if (!p[i]) {
				players.push(
					playersmap[g.players[i].id] = p[i] = {
						id: g.players[i].id,
						name:g.players[i].name,
						n:0,  // total number of games
						f:0,  // number of finished games
						s:0,  // sum of scores in finished games
						d:0,  // number of dropped games
						sd:0, // sum of scores in dropped games
						w:0,  // wins
						l:0,  // losses
					}
				);
			}
			p[i].n++;
		}
		if (g.status==="finished") {
			p[0].f++;
			p[1].f++;
			p[0].s += g.scores[0];
			p[1].s += g.scores[1];
			if (g.scores[0]>g.scores[1]) {
				p[0].w++;
				p[1].l++;
			} else {
				p[1].w++;
				p[0].l++;
			}
		} else {
			if (g.current===undefined) {
				console.log("unfinished game without current", m.id);
				return;
			}
			p[g.current].d++;
			p[g.current].sd += g.scores[g.current];
		}
	});
	players.forEach(f);
	return players.sort((a, b) => b.r-a.r);
}

function matrixInfo(messages){
	var playersmap = {}, players = [];
	messages.forEach(function(m){
		var	p = [], g = m.g;
		for (var i=0; i<2; i++) {
			p[i] = playersmap[g.players[i].id];
			if (!p[i]) {
				players.push(
					playersmap[g.players[i].id] = p[i] = {id:g.players[i].id, name:g.players[i].name, opponents:{}}
				);
			}
		}
		var games = p[0].opponents[p[1].id];
		if (!games) games = p[0].opponents[p[1].id] = [];
		games.push({id:m.id, f:g.status==="finished"});
	});
	return players;
}

exports.onCommand = function(ct, id){
	console.log("==================================\ntribostats "+ct.args);
	var keepBots = ct.args==="players";
	return this.queryRows(
		"select id, content from message where room=$1 and content like '!!game %' limit $2", [ct.shoe.room.id, 1000]
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
		return m && m.g && m.g.type==="Tribo"
			&& m.g.scores
			&& (m.g.status==="running"||m.g.status==="finished")
			&& (keepBots||m.g.players[0].name!=="meow")
	})
	.then(function(messages){
		var	title,
			cols,
			rows = [],
			players;
		switch (ct.args) {

		case "games":
			title = "Tribo Games played in this room (excluding the ones with bots)";
			cols = ["Game", "status", "Winner", "First Player", "Second Player"];
			messages.forEach(function(m){
				var winner = '-', status = '?';
				if (m.g.status==="finished") {
					winner = "**" + ( m.g.scores[0]>m.g.scores[1] ? m.g.players[0].name : m.g.players[1].name ) + "**";
					status = "finished";
				} else if (m.g.current>=0) {
					status = "waiting for "+m.g.players[m.g.current].name;
				}
				rows.push([
					"["+m.g.players[0].name+' *vs* '+m.g.players[1].name+"](#"+m.id+")",
					status,
					winner,
					m.g.scores[0],
					m.g.scores[1]
				]);
			});
			break;

		case "matrix":
			var	data = matrixInfo(messages),
				l = data.length<15 ? 3 : 2;
			title = "Tribo Games Matrix";
			cols = [' '].concat(data.map(function(p){
				var tokens = p.name.split(/[_-](?=\w)/);
				if (tokens.length==1) tokens = p.name.split(/(?:[a-z])(?=[A-Z])/);
				if (tokens.length==1) return p.name.slice(0, l);
				var s = tokens[0][0]+tokens[1][0];
				if (l>2 && tokens.length>2) s += tokens[2][0];
				return s;
			}));
			rows = data.map(function(p){
				return [p.name].concat(data.map(function(o){
					if (o.id===p.id) return "-";
					var games = p.opponents[o.id];
					if (!games) return " ";
					if (games.length===1) {
						if (games[0].f) return "**[X](#"+games[0].id+")**";
						else return "[X](#"+games[0].id+")";
					} else {
						return games.length;
					}
				}));
			});
			break;

		case "players":
			title = title || "Tribo players results in this room";
			cols = cols || ["Player", "Games", "Wins", "Losses", "Drops", "Avg Score"];
			players = playersInfos(messages, function(p){
				p.t = (p.s+p.sd)/(p.f+p.d); // average score including dropped games
				p.r = p.t + 2*p.w/(p.f+p.d) + 5*Math.log(p.n); // ranking value
			});
			console.log(players);
			rows = players.map(function(p){
				return [
					p.name,
					p.n,
					p.w,
					p.l,
					p.d,
					p.t.toFixed(2)
				];
			});
			break;

		default:
			throw "command not understood";
		}
		var c = title + ":\n"+
			cols.join('|')+'\n'+
			cols.map(()=>':-:').join('|')+'\n'+
			rows.map(r => r.join('|') ).join('\n');
		ct.reply(c, ct.nostore = c.length>2000);
	});
}
