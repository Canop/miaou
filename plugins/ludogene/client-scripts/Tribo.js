// Tribo game logic
// This file is imported both server-side and client-side
// A move is encoded in one character

var Tribo = (function(){

	// returns a square matrix filled with the provided value
	function matrix(s, v){
		var row = [], m = [];
		for (var i=0; i<s; i++) row[i] = v;
		for (var i=0; i<s; i++) m[i] = i ? row.slice() : row;
		return m;
	}

	return {
		// is the cell playable by p (assuming he's the current player) ?
		canPlay: function(g, x, y, p) {
			var c = g.cells;
			if (c[x][y] !== -1)  return false;
			return g.moves.length < 2 ||
				((x > 0 && c[x-1][y] == p) ||
				(x < 9 && c[x+1][y] == p) ||
				(y > 0 && c[x][y-1] == p) ||
				(y < 9 && c[x][y+1] == p) ||
				(x > 0 && y > 0 && c[x-1][y-1] == p) ||
				(x < 9 && y > 0 && c[x+1][y-1] == p) ||
				(x > 0 && y < 9 && c[x-1][y+1] == p) ||
				(x < 9 && y < 9 && c[x+1][y+1] == p));
		},
		isValid: function(g, move){
			return move.p === g.current && Tribo.canPlay(g, move.x, move.y, move.p);
		},
		getLines: function(g, x, y, p) {
			var c = g.cells, lines = [];
			if (x>0 && c[x-1][y]===p) {
				if ( x>1 && c[x-2][y]===p) {
					if ( (x<3||c[x-3][y]!==p) && (x===9||c[x+1][y]!==p) ) lines.push({x:x-2, y:y, d:'h'});
				} else if ( x<9 && c[x+1][y]===p && (x===8||c[x+2][y]!==p) ) lines.push({x:x-1, y:y, d:'h'});
			} else if ( x<8 && c[x+1][y]===p && c[x+2][y]===p && (x==7||c[x+3][y]!==p) ) lines.push({x:x, y:y, d:'h'});
			if (y>0 && c[x][y-1]===p) {
				if (y>1 && c[x][y-2]===p) {
					if ( (y<3||c[x][y-3]!==p) && (y===9||c[x][y+1]!==p) ) lines.push({x:x, y:y-2, d:'v'});
				} else if (y<9 && c[x][y+1]===p && (y===8||c[x][y+2]!==p) ) lines.push({x:x, y:y-1, d:'v'});
			} else if ( y<8 && c[x][y+1]===p && c[x][y+2]===p && (y===7||c[x][y+3]!==p) ) lines.push({x:x, y:y, d:'v'});
			return lines.length ? lines : null;
		},
		encodeMove: function(move){
			return String.fromCharCode(move.y*10+move.x + (move.p*100) + 40);
		},
		decodeMove: function(char){
			var code = char.charCodeAt(0)-40, player = 0;
			if (code > 99) {
				player = 1;
				code -= 100;
			}
			return {p:player, x:code%10, y:code/10|0};
		},
		// adds to the passed object what will be needed for restoration (the moves)
		store: function(g, obj){
			obj.moves = g.moves;
		},
		// (re)builds the state of the game from the moves (checks absolutely nothing)
		restore: function(g){
			g.cells = matrix(10, -1);
			if (g.moves) {
				var moves = [].map.call(g.moves, Tribo.decodeMove), lastMove = moves[moves.length-1];
				moves.forEach(function(move){
					g.cells[move.x][move.y] = move.p;
				});
				g.current = Tribo.getLines(g, lastMove.x, lastMove.y, lastMove.p) ? lastMove.p : +!lastMove.p;
			} else {
				g.current = 0;
				g.moves = "";
			}
			Tribo.computeZonesAndScores(g);
		},
		// apply a move to a game
		apply: function(g, move){
			move.lines = Tribo.getLines(g, move.x, move.y, move.p);
			g.cells[move.x][move.y] = move.p;
			g.current = (g.current+!move.lines)%2;
			Tribo.computeZonesAndScores(g);
		},
		//
		computeZonesAndScores: function(g){
			var nbmoves = g.moves.length;
			if (nbmoves<7) {
				g.scores = [nbmoves+1>>1, nbmoves>>1];
				return;
			}
			g.cellZone = matrix(10, null); // holds a pointer to the zone containing the cell
			var c = g.cells,
				zones = g.zones = [],
				seen = matrix(10, -1),
				hasMixZone = false;
			g.scores = [0, 0];
			function actz(x, y, zone){
				if (c[x][y] !== -1) {
					zone.access[c[x][y]] = true;
					return;
				}
				zone.size++;
				seen[x][y] = nbmoves;
				g.cellZone[x][y] = zone;
				if (x>0 && seen[x-1][y]<nbmoves) actz(x-1, y, zone);
				if (y>0 && seen[x][y-1]<nbmoves) actz(x, y-1, zone);
				if (x<9 && seen[x+1][y]<nbmoves) actz(x+1, y, zone);
				if (y<9 && seen[x][y+1]<nbmoves) actz(x, y+1, zone);
				if (x>0 && y>0 && seen[x-1][y-1]<nbmoves) actz(x-1, y-1, zone);
				if (x<9 && y>0 && seen[x+1][y-1]<nbmoves) actz(x+1, y-1, zone);
				if (x>0 && y<9 && seen[x-1][y+1]<nbmoves) actz(x-1, y+1, zone);
				if (x<9 && y<9 && seen[x+1][y+1]<nbmoves) actz(x+1, y+1, zone);
			}
			for (var x=0; x<10; x++){
				for (var y=0; y<10; y++){
					var p = c[x][y];
					if (p===-1) {
						if (seen[x][y]<nbmoves) {
							var zone = {size:0, access:[false,false]};
							zones.push(zone);
							actz(x, y, zone);
							if (zone.access[0] && zone.access[1]) {
								hasMixZone = true;
							} else {
								zone.owner = zone.access[1]*1;
								g.scores[zone.owner] += zone.size;
							}
						}
					} else {
						g.scores[p]++;
					}
				}
			}
			if (!hasMixZone) {
				g.status = "finished";
				g.current = -1;
			}
		}
	}
})();

if (typeof module !== 'undefined') {
	for (var fname in Tribo) {
		if (Tribo.hasOwnProperty(fname) && typeof Tribo[fname] === "function") {
			exports[fname] = Tribo[fname];
		}
	}
}
