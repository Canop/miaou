const	ludodb = require('./db.js'),
	K = 40,
	R = 750, // 300 to 1500 are OK. Make it greater to lower the impact of the Elo diff on gains
	NB_OPPONENTS_MIN = 3;

function Rating(playerId){ // rating of a player
	this.id = playerId;
	this.n = 0; // total number of games
	this.f = 0; // number of finished games
	this.c = 0; // number of counted games (finished, not ignored)
	this.cly = 0; // number of counted games last year
	this.op = new Map(); // map opponent Id -> shared object {n,f,c,cly} 
	this.d = 0; // number of dropped games
	this.malus = []; // array [[text,value],...]
	this.ms = 0; // sum of all malus
	this.e0 = 1000; // elo rating as first player
	this.e1 = 1000; // elo rating as second player
	this.r = 0; // global rating
	this.w = 0; // wins
	this.l = 0; // losses
}

// key in ["n","c","f","cly"], "c" being the default
Rating.prototype.nbOpponents = function(key){
	if (!key) key = "c";
	var sum = 0;
	this.op.forEach(function(opo){
		if (opo[key]) sum++;
	});
	return sum;
}

// compute this.malus and this.malusDetails
Rating.prototype.computeMalus = function(){
	var	m = this.malus = [];
	if (this.d) m.push([this.d+" dropped game"+(this.d>1?'s':''), this.d*50]);
	if (this.c < 5) m.push(["Less than 5 counted games", 130]);
	if (this.c < 10) m.push(["Less than 10 counted games", 160]);
	if (this.c < 50) m.push(["Less than 50 counted games", 50]);
	if (this.c < 100) m.push(["Less than 100 counted games", 20]);
	if (this.c < 150) m.push(["Less than 150 counted games", 15]);
	if (this.cly < 10) m.push(["Less than 10 counted games since a year", 70]);
	if (this.cly < 20) m.push(["Less than 20 counted games since a year", 30]);
	if (this.cly < 50) m.push(["Less than 50 counted games since a year", 20]);
	if (this.cly < 100) m.push(["Less than 100 counted games since a year", 10]);
	var	nbOpponents = this.nbOpponents(),
		nbOpponentsLastYear = this.nbOpponents('cly');
	if (nbOpponents < 5) m.push(["Less than 5 opponents", 170]);
	if (nbOpponents < 10) m.push(["Less than 10 opponents", 80]);
	if (nbOpponents < 15) m.push(["Less than 15 opponents", 25]);
	if (nbOpponents < 20) m.push(["Less than 20 opponents", 20]);
	if (nbOpponents < 50) m.push(["Less than 50 opponents", 15]);
	if (nbOpponentsLastYear < 3) m.push(["Less than 3 opponents since a year", 50]);
	if (nbOpponentsLastYear < 10) m.push(["Less than 10 opponents since a year", 30]);
	if (nbOpponentsLastYear < 15) m.push(["Less than 10 opponents since a year", 15]);
	this.ms = m.reduce(function(s,e){ return s+e[1] }, 0);
}

function GameImpact(m, r){ // impact of a game (note: the constructor has side effects on r)
	var g = m.g;
	this.p0 = r[0].id;
	this.p1 = r[1].id;
	var opo = r[0].op.get(this.p1); // informations common to those two players 
	if (!opo) {
		opo = {c:0, n:0, f:0, cly:0};
		r[0].op.set(this.p1, opo);
		r[1].op.set(this.p0, opo);
	}
	this.r = m.room;
	this.m = m.id;
	this.d0 = 0; // impact on the first player's Elo 0
	this.d1 = 0; // impact on the second player's Elo 1
	this.coef = 0;
	this.t = "";
	opo.n++;
	if (g.status==="finished") {
		r[0].f++;
		r[1].f++;
		opo.f++;
		var winnerIndex = +(g.scores[1]>=50);
		r[winnerIndex].w++;
		r[+!winnerIndex].l++;
		this.s = g.scores[0];
		var minc = Math.min(r[0].c, r[1].c) + 1;
		if ( (opo.c>50 && opo.c-50>.2*(minc-50)) || (opo.c>10 && opo.c-10>.5*(minc-10)) ) {
			this.t = "ignored";
			return;	
		}
		r[0].c++;
		r[1].c++;
		opo.c++;
		if (m.created+365*24*60*60>Date.now()/1000) {
			r[0].cly++;
			r[1].cly++;
			opo.cly++;
		}
		if (r[0].c<5 || r[1].c<5) {
			this.coef = .2;
		} else if (r[0].c<10 || r[1].c<10) {
			this.coef = .5;
		} else {
			this.coef = 1;
		}
		// var v = .5 + g.scores[winnerIndex]/200; // in ].75,1[
		var v = .6 + (g.scores[winnerIndex]-50)*.0084; // in ].6,1[
		this.v = winnerIndex ? 1-v : v;
		this.D = r[0].e0-r[1].e1; 
		if (this.D>100) this.D = 100 + (this.D-100)*.7;
		this.p = 1 / ( 1 + Math.pow(10, - this.D/R)); // in ]0,1[
		this.d0 = this.coef * K * (this.v - this.p);
		this.d1 = -this.d0;
	} else if ( m.changed < Date.now()/1000 - 24*60*60 ) {
		r[g.current].d++;
		this.t = r[g.current].name + " forfeited";
	} else {
		this.t = "in progress";
	}
	r[0].e0 += this.d0;
	r[1].e1 += this.d1;
}
GameImpact.prototype.gameLink = function(data){
	return "["+data.ratingsMap.get(this.p0).name+" ("+(this.s||'')
		+") - "+data.ratingsMap.get(this.p1).name
		+" ("+((100-this.s)||'')+")]("+this.r+"#"+this.m+")";
}

function userLink(data, userId){
	return "["+data.ratingsMap.get(userId).name+"](u/"+userId+")";
}
function compute(messages){
	var	ratingsMap = new Map(),
		ratings = [],
		log = [];
	messages.forEach(function(m){
		var	r = [],
			g = m.g;
		for (var i=0; i<2; i++) {
			r[i] = ratingsMap.get(g.players[i].id);
			if (!r[i]) {
				r[i] = new Rating(g.players[i].id);
				ratingsMap.set(r[i].id, r[i]);
				ratings.push(r[i]);
			}
			r[i].name = g.players[i].name;
			r[i].n++;
		}
		log.push(new GameImpact(m, r));
	});
	ratings.forEach(function(r){
		r.r = r.e0+r.e1;
		r.computeMalus();
		r.r -= r.ms;
	});
	ratings = ratings
	.filter(function(r){ return r.nbOpponents() >= NB_OPPONENTS_MIN })
	.sort(function(a,b){ return b.r-a.r });
	return { log:log, ratings:ratings, ratingsMap:ratingsMap };
}

function table(cols, rows){
	var t = '';
	if (cols) t += cols.join('|')+'\n';
	t += (cols||rows[0]||[]).map(function(){ return ':-:' }).join('|')+'\n';
	t += rows.map(function(r){ return r.join('|')+'|' }).join('\n')+'\n';
	return t;
}

// builds the ratings table in markdown
// If userId is provided, the table contains only the relevant line
function ratingsTable(data, userId){
	return "## Rating"+(userId?'':'s')+":\n" + table(
		["Rank", "Player", "Games", "Opponents", "Wins", "Losses", "Drops",
		"Elo 1st player", "Elo 2nd player", "Malus", "Global Rating"],
		data.ratings
		.filter(function(r,i){
			r.rank = i+1;
			return !userId || userId===r.id; 
		})
		.map(function(r){
			return [
				'**'+r.rank+'**',
				'['+r.name+'](u/'+r.id+')',
				r.f,
				r.nbOpponents(),
				r.w,
				r.l,
				r.d||' ',
				Math.round(r.e0),
				Math.round(r.e1),
				r.ms||' ',
				'**'+Math.round(r.r)+'**'
			];
		})
	);
}

function dbl(v){
	return v ? v.toFixed(1) : ' ';
}

function gamesTable(data){
	return "## Games:\n" + table(
		["Game", /* "v", "D", "p", */ "ΔElo 1st player", "ΔElo 2nd player", "Comments"],
		data.log.map(function(e){
			return [
				e.gameLink(data),
				// dbl(e.v), dbl(e.D), dbl(e.p),
				dbl(e.d0), dbl(e.d1),
				e.t || ' '
			];
		})
	);
}
function userGamesTable(data, r){
	return "## Games:\n" + table(
		["Game", "Coef", "ΔElo ["+r.name+"](u/"+r.id+")", "Comments"],
		data.log
		.filter(function(e){
			return e.p0===r.id || e.p1===r.id
		})
		.map(function(e){
			return [
				e.gameLink(data),
				e.coef || ' ',
				dbl(e.p0===r.id ? e.d0 : e.d1),
				e.t || ' '
			];
		})
	);
}

function opponentsTable(data, r) {
	var	s = "## Opponents:\n",
		rows = [];
	r.op.forEach(function(opo, uid){
		rows.push([userLink(data, uid), opo.n, opo.c, opo.cly]);
	});
	s += table(["Opponent", "Games", "Counted Games", "Recent Counted Games"], rows);
	return s;
}

exports.onCommand = function(ct){
	console.log("==========================\nELO COMPUTING "+ct.args);
	var st = Date.now();
	return ludodb.getGameMessages(this)
	.filter(function(m){
		return	m.g.type==="Tribo"
			&& m.g.scores
			&& (m.g.status==="running"||m.g.status==="finished")
	})
	.then(function(messages){
		var	userMatch = ct.args.match(/@[\w\-]+/);
		return [compute(messages), userMatch ? this.getUserByName(userMatch[0].slice(1)) : null];
	})
	.spread(function(data, user){
		var	c = "Elo based Tribo ladder" + ':\n'
			showOppenents = /\bopponents?\b/.test(ct.args),
			showLog = /\bgames\b/.test(ct.args);
		if (user) {
			var r = data.ratingsMap.get(user.id);
			if (!r) {
				c += 'No game found for @'+user.name+' in public rooms';
			} else if (r.nbOpponents("c")<NB_OPPONENTS_MIN) {
				c += "You must have finished a game against at least " + NB_OPPONENTS_MIN +
					" different players to be ranked.\n";
				c += '@'+user.name+" played against " + r.nbOpponents("c") + " other players:\n";
				c += opponentsTable(data, r);
			} else {
				c += ratingsTable(data, r.id);
				c += "Counted games: "+r.c+"\n";
				if (r.ms) c += "## Malus:\n" + table(null, r.malus);
				if (showOppenents) c += opponentsTable(data, r);
				if (showLog) c += userGamesTable(data, r);
			}
		} else {
			c += ratingsTable(data);
			if (showLog) c += gamesTable(data);
		}
		console.log("ELO COMPUTING done in " + (Date.now()-st) + "ms");
		ct.reply(c, ct.nostore = c.length>3000);
	});
}
