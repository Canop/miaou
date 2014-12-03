exports.onCommand = function(ct, id){
	console.log("==================================\ntribostats "+ct.args);
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
		return m && m.g && (m.g.status==="running"||m.g.status==="finished") && m.g.type==="Tribo";
	})
	.then(function(messages){
		var title, cols, rows = [], f;
		switch (ct.args) {
		case "games":
			title = "Tribo Games started in this room";
			cols = ["Game","status", "Winner","First Player","Second Player"];
			messages.forEach(function(m){
				if (!m.g.scores) return;
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
		case "twc":
			title = "Tribo World Cup Style Scoring";
			messages = messages.filter(function(m){
				return m.g.players[0].name !== "meow";
			});
			f = function(p){ p.f = 2*p.w + p.s };
			cols = ["Player", "Games", "Wins", "Losses", "Unfinished", "Mean Score", "TWC Score"];
		case "players":
			title = title || "Tribo players results in this room (this isn't a ladder)";
			cols = cols || ["Player", "Games", "Wins", "Losses", "Drops", "Mean Score"/*, "F"*/];
			var playersmap = {}, players = [];
			messages.forEach(function(m){
				var	p = [], g = m.g;
				if (!g.scores) return;
				for (var i=0; i<2; i++) {
					p[i] = playersmap[g.players[i].id];
					if (!p[i]) {
						players.push(
							playersmap[g.players[i].id] = p[i] = {n:0, s:0, w:0, l:0, d:0}
						);
					}
					p[i].name = g.players[i].name; // we want the last one
					p[i].n++; // number of games started and not dropped
					p[i].s += g.scores[i];
				}
				if (g.status!=="finished") {
					if (g.current===undefined) {
						console.log("unfinished game without current", m.id);
						return;
					}
					p[g.current].d++; // drop
					var nd = +!g.current; // non dropper
					p[nd].s -= g.scores[nd];
					p[nd].n--;
				} else if (g.scores[0]>g.scores[1]) {
					p[0].w++;
					p[1].l++;
				} else {
					p[1].w++;
					p[0].l++;					
				}
			});
			players = players.filter(function(p){ return p.n });
			if (!f) f = function(p){ p.f = (2*p.w+p.s-10*p.d)/p.n + 3*Math.log(p.n+1); }
			players.forEach(f);
			players.sort(function(a,b){ return b.f-a.f });
			console.log(players);
			rows = players.map(function(p){
				var cells = [
					p.name,
					p.n,
					p.w,
					p.l,
					p.d,
					(p.s/p.n).toFixed(2)
				];
				if (cols.length>cells.length) cells.push(p.f);
				return cells;
			});
			break;
		default:
			throw "command not understood";
		}
		var c = title + ":\n"+
			cols.join('|')+'\n'+
			cols.map(function(){ return ':-:' }).join('|')+'\n'+
			rows.map(function(r){ return r.join('|') }).join('\n');
		ct.reply(c, ct.nostore = c.length>2000);
	});
}
