// Flore game logic

var Flore = (function(){
	
	var T = 8, S = T-1,
		GOAL = 10,
		NO_CELL = -2,
		NO_PLAYER = -1;
		
	return {
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
		// returns the flowers which would be killed by a move at some position
		//~ kills: function(g, i, j){
			//~ 
		//~ },
		// is the cell playable by p (assuming he's the current player) ?
		canPlay: function(g, x, y) {
			return !!(x%S+y%S && g.cells[x][y]===NO_PLAYER);
		},
		isValid: function(g, move){
			return !!(move.p===g.current && move.x%S+move.y%S && g.cells[move.x][move.y]===NO_PLAYER);
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
			var x = move.x, y = move.y;
			g.cells[x][y] = move.p;
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
					if (g.cells[i][j]>=0 && g.flowersAround[i][j]>3 && (i!==x||j!=y)) {
						move.deaths.push({p:g.cells[i][j], x:i, y:j});
					}
				}
			}
			move.deaths.forEach(function(d){
				var x = d.x, y = d.y;
				g.cells[d.x][d.y] = NO_PLAYER;
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
		// (re)builds the state of the game
		// In case of a new game, initializes a random board
		restore: function(g){
			g.flowersAround = [];
			if (!g.cells) {
				g.current = 0;
				g.scores = [0, 0];
				g.moves = "";
				g.cells = [];
				for (var i=0; i<T; i++) {
					g.cells[i] = [];
					g.flowersAround[i] = [];
					for (var j=0; j<T; j++) {
						g.cells[i][j] = i%S+j%S ? NO_PLAYER : NO_CELL;
						g.flowersAround[i][j] = 0;
					}
				}
				for (var i=Math.random()*2+2|0; i-->0;) {
					g.cells[1+Math.random()*(S-1)|0][1+Math.random()*(S-1)|0] = NO_CELL
				}
			} else {
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
				g.current = g.finished ? -1 : g.moves.length%2;
			}
		}
	}

})();

if (typeof module !== 'undefined') {
	for (var fname in Flore) {
		if (Flore.hasOwnProperty(fname) && typeof Flore[fname] === "function") {
			exports[fname] = Flore[fname];
		}
	}
}
