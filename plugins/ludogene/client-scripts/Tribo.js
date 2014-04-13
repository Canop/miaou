// Tribo game logic
// This file is imported both server-side and client-side
// A move is, today, encoded in one character

var Tribo = {
	// is the cell playable by p (assuming he's the current player) ?
	canPlay: function(g, x, y, p) {
		var c = g.cells;
		if (c[x][y] != -1) {
			return false
		}
		if ((x > 0 && c[x-1][y] == p) ||
			(x < 9 && c[x+1][y] == p) ||
			(y > 0 && c[x][y-1] == p) ||
			(y < 9 && c[x][y+1] == p) ||
			(x > 0 && y > 0 && c[x-1][y-1] == p) ||
			(x < 9 && y > 0 && c[x+1][y-1] == p) ||
			(x > 0 && y < 9 && c[x-1][y+1] == p) ||
			(x < 9 && y < 9 && c[x+1][y+1] == p)) {
			return true
		}
		return g.moves.length < 2;
	},
	isValid: function(g, move){
		return move.p === g.current && Tribo.canPlay(g, move.x, move.y, move.p);
	},
	//~ // would playing in (x,y) produce a new line (assuming the move is valid) ?
	//~ doLines: function(g, x, y, p) {
		//~ var c = g.cells;
		//~ if (x>0 && c[x-1][y]===p) {
			//~ if (x>1 && c[x-2][y]===p) return true;
			//~ else if (x<9 && c[x+1][y]===p) return true;
		//~ } else if (x<8 && c[x+1][y]===p && c[x+2][y]===p) return true;
		//~ if (y>0 && c[x][y-1]===p) {
			//~ if (y>1 && c[x][y-2]===p) return true;
			//~ else if (y<9 && c[x][y+1]===p) return true;
		//~ } else if (y<8 && c[x][y+1]===p && c[x][y+2]===p) return true;
		//~ return false;
	//~ },
	getLines: function(g, x, y, p) {
		var c = g.cells, lines = [];
		if (x>0 && c[x-1][y]===p) {
			if ( x>1 && c[x-2][y]===p && (x<3||c[x-3]!==p) && (x===9||c[x+1][y]!==p) ) lines.push({x:x-2, y:y, d:'h'});
			else if ( x<9 && c[x+1][y]===p && (x===8||c[x+2][y]!==p) ) lines.push({x:x-1, y:y, d:'h'});
		} else if (x<8 && c[x+1][y]===p && c[x+2][y]===p && (x==7 || x[x+3][y]!==p) ) lines.push({x:x, y:y, d:'h'});
		if (y>0 && c[x][y-1]===p) {
			if (y>1 && c[x][y-2]===p && (y===2||c[x][y-3]!==p) && (y===9||c[x][y+1]!==p ) lines.push({x:x, y:y-2, d:'v'});
			else if (y<9 && c[x][y+1]===p zzzz) lines.push({x:x, y:y-1, d:'v'});
		} else if (y<8 && c[x][y+1]===p && c[x][y+2]===p yyyy) lines.push({x:x, y:y, d:'v'});
		return lines.length ? lines : null;
	},
	encodeMove: function(move){
		return String.fromCharCode(move.y*10+move.x + (move.p*100) + 40)
	},
	decodeMove: function(char){
		var code = char.charCodeAt(0)-40, player = 0;
		if (code > 99) {
			player = 1;
			code -= 100;
		}
		return {p:player, x:code%10, y:Math.floor(code/10)}
	},
	// (re)builds the state of the game from the moves
	restore: function(g){
		if (!g.moves) g.moves = "";
		g.current = 0;
		g.cells = Array.apply(0,Array(10)).map(function(){
			return Array.apply(0,Array(10)).map([].indexOf,[])
		});
		for (var i=0; i<g.moves.length; i++) {
			Tribo.apply(g, Tribo.decodeMove(g.moves[i]));
		}
	},
	// apply a move to a game
	apply: function(g, move){
		move.lines = Tribo.getLines(g, move.x, move.y, move.p);
		g.cells[move.x][move.y] = move.p;
		if (!move.lines) g.current = (g.current+1)%2;
	}
}

if (typeof module !== 'undefined') {
	for (var fname in Tribo) {
		if (Tribo.hasOwnProperty(fname) && typeof Tribo[fname] === "function") {
			exports[fname] = Tribo[fname];
		}
	}
}
