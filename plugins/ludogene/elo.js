const	K = 30,
	NB_OPPONENTS_MIN = 3;

function Rating(playerId){ // rating of a player
	this.id = playerId;
	this.n = 0; // total number of games
	this.f = 0; // number of finished games
	this.op = Object.create(null); // map opponent Id -> nb finished games in common
	this.d = 0; // number of dropped games
	this.malus = 0; // dropping games malus
	this.e0 = 1000; // elo rating as first player
	this.e1 = 1000; // elo rating as second player
	this.r = 0; // global rating
	this.w = 0; // wins
	this.l = 0; // losses
	this.name = ''; // updated at every games
}
Rating.prototype.nbOpponents = function(){
	return Object.keys(this.op).length;
}
function GameImpact(m, r){ // impact of a game (note: the constructor has side effects on r)
	var g = m.g;
	r[0].op[r[1].id] = (r[0].op[r[1].id] || 0) + 1;
	r[1].op[r[0].id] = (r[1].op[r[0].id] || 0) + 1;
	this.r = m.room;
	this.m = m.id;
	this.p0 = r[0].id;
	this.p1 = r[1].id;
	this.d0 = 0; // impact on the first player's Elo 0
	this.d1 = 0; // impact on the second player's Elo 1
	this.t = "";
	if (g.status==="finished") {
		r[0].f++;
		r[1].f++;
		// todo ignore if too many games between those players (> 50% of one of the players games ?)
		var winnerIndex = +(g.scores[1]>=50);
		r[winnerIndex].w++;
		r[+!winnerIndex].l++;
		var v = .5 + g.scores[winnerIndex]/200; // in ].75,1[
		this.s = g.scores[0];
		this.v = winnerIndex ? 1-v : v;
		this.D = r[0].e0-r[1].e1; 
		this.p = 1 / ( 1 + Math.pow(10, -this.D/400)); // in ]0,1[
		this.d0 = K * (this.v - this.p);
		this.d1 = -this.d0;
	} else if ( m.changed < (Date.now()/1000|0) - 2*60*60 ) {
		if (g.current===undefined) {
			console.log("unfinished game without current", m.id);
			return;
		}
		r[g.current].d++;
		this[g.current?'d1':'d0'] = -2*K; 
		this.t = "User dropped the game.";
	} else {
		this.t = "Game in progress";
	}
	r[0].e0 += this.d0;
	r[1].e1 += this.d1;
}
function compute(messages){
	var	ratingsMap = Object.create(null),
		ratings = [],
		log = [];
	messages.forEach(function(m){
		var	r = [],
			g = m.g;
		for (var i=0; i<2; i++) {
			r[i] = ratingsMap[g.players[i].id];
			if (!r[i]) {
				r[i] = new Rating(g.players[i].id);
				ratingsMap[r[i].id] = r[i];
				ratings.push(r[i]);
			}
			r[i].name = g.players[i].name;
			r[i].n++;
		}
		var	gi = new GameImpact(m, r),
			s = gi.d0 + gi.d1;
		if (s != 0) {
			console.log("Elo: redistributing", -s);
			s /= -2*ratings.length;
			for (var i=0; i<ratings.length; i++) {
				ratings[i].e0 += s;
				ratings[i].e1 += s;
			}
		}
		log.push(gi);
	});
	ratings.forEach(function(r){
		r.r = r.e0+r.e1;
	});
	ratings = ratings
	.filter(function(r){ return r.nbOpponents() >= NB_OPPONENTS_MIN })
	.sort(function(a,b){ return b.r-a.r });
	return { log:log, ratings:ratings, ratingsMap:ratingsMap };
}

function table(cols, rows){
	return	cols.join('|')+'\n'+
		cols.map(function(){ return ':-:' }).join('|')+'\n'+
		rows.map(function(r){ return r.join('|')+'|' }).join('\n')+'\n';
}

function ratingsTable(data, userId){
	return "## Ratings:\n" + table(
		["Rank", "Player", "Games", "Opponents", "Wins", "Losses", "Drops", "Elo 1st player", "Elo 2nd player", "Global Rating"],
		data.ratings
		.filter(function(r,i){
			r.rank = i+1;
			return !userId || userId===r.id; 
		})
		.map(function(r){
			return [
				'**'+r.rank+'**',
				r.name,
				r.n,
				r.nbOpponents(),
				r.w,
				r.l,
				r.d,
				Math.round(r.e0),
				Math.round(r.e1),
				'**'+Math.round(r.r)+'**'
			];
		})
	);
}

function dbl(v){
	return v ? v.toFixed(3) : ' ';
}

function logTable(data, userId){
	return "## Games:\n" + table(
		["Game", "v", "D", "p", "ΔElo 1st player", "ΔElo 2nd player", "Comments"],
		data.log
		.filter(function(e){
			return !userId || e.p0===userId || e.p1===userId
		})
		.map(function(e){
			return [
				"["+data.ratingsMap[e.p0].name+" ("+(e.s||'')+") - "+data.ratingsMap[e.p1].name+" ("+((100-e.s)||'')+")]("+e.r+"#"+e.m+")",
				dbl(e.v), dbl(e.D), dbl(e.p),
				dbl(e.d0), dbl(e.d1),
				e.t || ' '	
			];
		})
	);
}

exports.onCommand = function(ct, id){
	console.log("==========================\nELO COMPUTING "+ct.args);
	var st = Date.now();
	return this.queryRows(
		"select message.id, room, content, changed from message join room on message.room=room.id"+
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
		return m && m.g && m.g.type==="Tribo"
			&& m.g.scores
			&& (m.g.status==="running"||m.g.status==="finished")
	})
	.then(function(messages){
		var	userMatch = ct.args.match(/@[\w\-]+/);
		return [compute(messages), userMatch ? this.getUserByName(userMatch[0].slice(1)) : null];
	})
	.spread(function(data, user){
		var	c = "ELO BASED TRIBO LADDER - ALPHA TESTS" + ':\n'
			showLog = /\bgames\b/.test(ct.args);
		if (user) {
			var r = data.ratingsMap[user.id];
			if (!r) {
				c += 'No game found for @'+user.name+' in public rooms';
			} else if (r.nbOpponents()<NB_OPPONENTS_MIN) {
				c += "You must have played against at least " + NB_OPPONENTS_MIN +
					" different players to be ranked.\n";
				c += '@'+user.name+" played against " + r.nbOpponents() + " other players:\n"
					+ Object.keys(r.op).map(function(uid){ return '* '+data.ratingsMap[uid].name }).join('\n');
			} else {
				c += ratingsTable(data, r.id);
				if (showLog) c += logTable(data, r.id);
			}
		} else {
			c += ratingsTable(data);
			if (showLog) c += logTable(data);
		}
		console.log("ELO COMPUTING done in " + (Date.now()-st) + "ms");
		ct.reply(c, ct.nostore = c.length>3000);
	});
}
