// Flore game logic

// The cells matrix contains, for each cell
// 	* NO_CELL when there's no hole in which to plant flowers
// 	* NO_PLAYER when the hole is empty (it's thus possible to play here)
// 	* >=0 (0 or 1) when there's a flower owned by player 0 or 1
// 	* DEATH_START to DEATH_END when there's a flower corpse (preventing new flowers)
var Flore = (function(){

	var	T = 6,
		GOAL = 5,
		NO_CELL = -2,
		NO_PLAYER = -1,
		DEATH_START = -6,
		DEATH_END = -3;

	return {
		T: T,
		GOAL: GOAL,
		NO_CELL: NO_CELL,
		NO_PLAYER: NO_PLAYER,
		DEATH_START: DEATH_START,
		DEATH_END: DEATH_END,
		encodeMove: function(move){
			return String.fromCharCode(move.y*T+move.x + (move.p*100) + 40);
		},
		decodeMove: function(char){
			var code = char.charCodeAt(0)-40, player = 0;
			if (code > 99) {
				player = 1;
				code -= 100;
			}
			return {p:player, x:code%T, y:Math.floor(code/T)};
		},
		// is the cell playable by p (assuming he's the current player) ?
		canPlay: function(g, x, y){
			return g.cells[x][y]===NO_PLAYER;
		},
		isValid: function(g, move){
			return move.p===g.current && g.cells[move.x][move.y]===NO_PLAYER;
		},
		addAround: function(g, x, y, d){
			if (x>0) {
				if (y>0) g.flowersAround[x-1][y-1]+=d;
				g.flowersAround[x-1][y]+=d;
				if (y<T-1) g.flowersAround[x-1][y+1]+=d;
			}
			if (y>0) g.flowersAround[x][y-1]+=d;
			if (y<T-1) g.flowersAround[x][y+1]+=d;
			if (x<T-1) {
				if (y>0) g.flowersAround[x+1][y-1]+=d;
				g.flowersAround[x+1][y]+=d;
				if (y<T-1) g.flowersAround[x+1][y+1]+=d;
			}
		},
		apply: function(g, move){
			var	x = move.x,
				y = move.y,
				cells = g.cells;
			cells[x][y] = move.p;
			move.deaths = [];
			if (x>0) {
				if (y>0) g.flowersAround[x-1][y-1]++;
				g.flowersAround[x-1][y]++;
				if (y<T-1) g.flowersAround[x-1][y+1]++;
			}
			if (y>0) g.flowersAround[x][y-1]++;
			if (y<T-1) g.flowersAround[x][y+1]++;
			if (x<T-1) {
				if (y>0) g.flowersAround[x+1][y-1]++;
				g.flowersAround[x+1][y]++;
				if (y<T-1) g.flowersAround[x+1][y+1]++;
			}
			for (var i=0; i<T; i++) {
				for (var j=0; j<T; j++) {
					if (i===x && j===y) continue;
					var cell = cells[i][j];
					if (cell<DEATH_END) {
						cells[i][j]++;
					} else if (cell===DEATH_END) {
						cells[i][j] = NO_PLAYER;
					} else if (cell>=0 && g.flowersAround[i][j]>3) {
						move.deaths.push({p:cell, x:i, y:j});
					}
				}
			}
			move.deaths.forEach(function(d){
				var	x = d.x,
					y = d.y;
				cells[d.x][d.y] = DEATH_START;
				g.scores[+!d.p]++;
				if (x>0) {
					if (y>0) g.flowersAround[x-1][y-1]--;
					g.flowersAround[x-1][y]--;
					if (y<T-1) g.flowersAround[x-1][y+1]--;
				}
				if (y>0) g.flowersAround[x][y-1]--;
				if (y<T-1) g.flowersAround[x][y+1]--;
				if (x<T-1) {
					if (y>0) g.flowersAround[x+1][y-1]--;
					g.flowersAround[x+1][y]--;
					if (y<T-1) g.flowersAround[x+1][y+1]--;
				}
			});
			if (g.scores[0]>=GOAL||g.scores[1]>=GOAL) {
				g.status = "finished";
				g.current = -1;
			} else {
				g.current = +!g.current;
			}
		},
		// adds to the passed object what will be needed for restoration (the moves and the cells)
		store: function(g, obj){
			obj.moves = g.moves;
			obj.scores = g.scores;
			obj.cells = g.cells;
		},
		init: function(g){
			g.current = 0;
			g.scores = [0, 0];
			g.moves = "";
			g.cells = [];
			for (var i=0; i<T; i++) {
				g.cells[i] = [];
				for (var j=0; j<T; j++) {
					g.cells[i][j] = NO_PLAYER;
				}
			}
			g.cells[0][0] = NO_CELL;
			g.cells[0][T-1] = NO_CELL;
			g.cells[T-1][0] = NO_CELL;
			g.cells[T-1][T-1] = NO_CELL;
			for (var i=Math.random()*2+3|0; i-->0;) {
				g.cells[Math.random()*T|0][Math.random()*T|0] = NO_CELL
			}
		},
		// (re)builds the state of the game
		restore: function(g){
			g.flowersAround = [];
			if (!g.cells) {
				console.log("Uninitialized Flore Game!", g);
				Flore.init(g);
			}
			for (var i=0; i<T; i++) {
				g.flowersAround[i] = [];
				for (var j=0; j<T; j++) {
					g.flowersAround[i][j] = 0;
				}
			}
			for (var i=0; i<T; i++) {
				for (var j=0; j<T; j++) {
					if (g.cells[i][j]>=0) {
						Flore.addAround(g, i, j, 1);
					}
				}
			}
			g.current = g.status==="finished" ? -1 : g.moves.length%2;
		},
		// computes for Elo rating the value of the winner sw score when
		//  the opponent has a score of sl.
		// The Elo computation system needs a value in ]0.6, 1[
		scoreEloV: function(sw, sl){
			return .57 + relax((sw*1.27 - sl)*.1)*.43;
		}
	}

})();

function relax(t){
	return (1 - Math.exp(-t)) / (1 + Math.exp(-t))
}

if (typeof module !== 'undefined') {
	for (var fname in Flore) {
		if (Flore.hasOwnProperty(fname)) {
			exports[fname] = Flore[fname];
		}
	}
}
