miaou(function(games, gui, locals, ws){

	var	Flore = window.Flore,
		T = Flore.T,
		NO_CELL = Flore.NO_CELL,
		NO_PLAYER = Flore.NO_PLAYER,
		DEATH_START = Flore.DEATH_START,
		DEATH_END = Flore.DEATH_END,
		CS = 24, // size of a cell in pixels
		BR = CS/2-2, // radius of a board dot
		colors = ['#ADD8E6', 'red'], // blue, red
		textColors = ['#ADD8E6', '#FA8072'],
		bg = "linear-gradient(#17672b, #031)";

	function Panel(m, g, s, availableWidth, abstract){
		this.m = m;
		this.g = g; // game
		this.s = s; // svg root
		this.u = -1; // user index in the game
		this.grads = colors.map(function(c){ return s.rgrad(0.3, 0.3, 1, c, '#000') });
		this.holeGrad = s.rgrad(0.3, 0.3, 1, 'rgba(0,5,0,0.5)', 'rgba(0,50,10,.5)');
		g.players.forEach((p, i)=>{ if (p.id===locals.me.id) this.u=i });
		if (abstract) {
			this.layout = "row";
			this.W = availableWidth;
			this.H = 45;
			this.XB = 0;
			this.RS = this.W - 15; // right of the scores
			this.YB = (this.H - T*CS)/2;
			this.XS = 20;
			this.LHS = 20;
		} else if (availableWidth>400) {
			this.layout = "row";
			this.W = Math.min(700, 400+.3*(availableWidth-400)); // width of the whole drawed area
			this.H = 150; // height of the whole drawed area
			this.XB = (this.W - T*CS); // X of the board
			this.RS = this.XB - 15; // right of the scores
			this.YB = (this.H - T*CS)/2+2;
			this.XS = Math.max(20, this.XB-194);
			this.LHS = 28; // height of a score line
		} else {
			// column layout's reason d'etre is the mobile version of miaou
			this.layout = "column";
			this.W = T*CS;
			this.W += Math.max(4, (availableWidth-this.W)/2);
			this.H = 220;
			this.XB = (this.W - T*CS);
			this.RS = this.W - 15;
			this.YB = 70;
			this.XS = this.XB+15;
			this.LHS = 28; // height of a score line
		}
		this.abstract = abstract;
	}

	Panel.prototype.buildBoard = function(){
		if (this.abstract) return;
		this.holes = [];
		for (var i=0; i<T; i++) this.holes[i] = [];
	}

	Panel.prototype.drawFlower = function(cx, cy, color, radius, hole){
		var	r = radius*.6,
			flower = ù('<svg', hole);
		ù('<circle', flower).attr({cx:cx, cy:cy-r, r:r, fill:color});
		ù('<circle', flower).attr({cx:cx+r, cy:cy, r:r, fill:color});
		ù('<circle', flower).attr({cx:cx, cy:cy+r, r:r, fill:color});
		ù('<circle', flower).attr({cx:cx-r, cy:cy, r:r, fill:color});
		ù('<circle', flower).attr({cx:cx, cy:cy, r:r*.6, fill:"#FFD700", strokeWidth:1});
		return flower;
	}

	Panel.prototype.drawCell = function(i, j){
		var	cell = this.g.cells[i][j];
		if (cell===NO_CELL) return;
		// 	-> détection de kill de fleur, animation puis suppression
		var	hole = this.holes[i][j];
		if (this.holes[i][j]) {
			this.holes[i][j].remove();
		}
		var	panel = this,
			cx = this.XB+i*CS,
			cy = this.YB+j*CS,
			d = CS/2,
			hole = this.holes[i][j] = ù('<svg', this.s).attr({x:cx, y:cy}),
			c = ù('<circle', hole).attr({cx:d, cy:d, r:BR, fill: this.holeGrad}),
			userIsCurrentPlayer = this.g.current!==-1 && this.u===this.g.current;
		if (cell>=0) { // has living flower
			this.drawFlower(d, d, this.grads[cell], BR, hole);
			return;
		}
		if (cell<=DEATH_END) {
			var ratio = .8 - (cell-DEATH_START)*.45/(DEATH_END-DEATH_START);
			this.drawFlower(d, d, "white", BR*ratio, hole).attr("opacity", .2);
			return;
		}
		if (!userIsCurrentPlayer) return;
		if (Flore.canPlay(this.g, i, j)) {
			c.attr({cursor:'pointer'})
			.on('mouseenter', function(){
				c.attr({fill: textColors[panel.u]});
			})
			.on('mouseleave click', function(){
				c.attr({fill: panel.holeGrad});
			})
			.on('click', function(){
				ws.emit('ludo.move', {mid:panel.m.id, move:Flore.encodeMove({p:panel.u, x:i, y:j})});
			});
		}
	}

	Panel.prototype.drawBoard = function(){
		if (this.abstract) return;
		for (var i=0; i<T; i++) {
			for (var j=0; j<T; j++) {
				this.drawCell(i, j);
			}
		}
	}

	Panel.prototype.removeLastMoves = function(){
		if (!this.lastMoves) return;
		for (var lm; (lm = this.lastMoves.shift());) lm.remove();
	}

	Panel.prototype.drawLastMoves = function(playerIndex){
		this.removeLastMoves();
		var	panel = this,
			lastMoves = [],
			found = false;
		for (var i=this.g.moves.length; i-->0;) {
			var move = Flore.decodeMove(this.g.moves.charAt(i));
			if (move.p === playerIndex) {
				found = true;
				lastMoves.push(move);
			} else if (found) {
				break;
			}
		}
		this.lastMoves = lastMoves.map(function(move){
			return ù('<circle', panel.s).attr({
				cx: panel.XB+move.x*CS+CS/2,
				cy: panel.YB+move.y*CS+CS/2,
				r: BR+1,
				fill: "none",
				stroke: "GoldenRod",
				strokeWidth: 2
			});
		});
	}

	Panel.prototype.buildScores = function(){
		var panel = this, s = panel.s, XS = this.XS, RS = this.RS;
		panel.names = panel.g.players.map(function(player, i){
			var name = player.name;
			var text = ù('<text', s)
			.text(name.length>21 ? name.slice(0, 18)+'…' : name)
			.attr({ x:XS, y:panel.LHS*(i+1), fill:textColors[i] });
			if (!panel.abstract) {
				text.on('mouseenter', panel.drawLastMoves.bind(panel, i))
				.on('mouseleave', panel.removeLastMoves.bind(panel))
				.attr({ fontWeight:'bold', cursor:"help" });
			}
			return text;
		});
		panel.scores = panel.g.players.map(function(player, i){
			return ù('<text', s).text('0').attr({
				x:RS, y:panel.LHS*(i+1), fill:textColors[i],
				fontWeight:'bold', textAnchor:'end'
			});
		});
	}

	Panel.prototype.drawScores = function(){
		var g = this.g;
		this.scores.forEach(function(s, i){ s.text(g.scores[i]) });
		if (this.currentPlayerMark) this.currentPlayerMark.remove();
		if (this.g.current >= 0) {
			this.currentPlayerMark = ù('<text', this.s).text("►").attr({
				x:this.XS-15, y:this.LHS*(g.current+1),
				fill:this.grads[g.current], fontWeight:'bold'
			});
		} else {
			this.currentPlayerMark = ù('<text', this.s).text("♛").attr({
				x:this.XS-18, y:this.LHS*((g.scores[1]>=g.scores[0])+1),
				fill:"Goldenrod", fontWeight:'bold', fontSize:"140%"
			});
		}
	}

	Panel.prototype.addReplayPlayer = function($c){
		$c.find(".ludo-flore-button, .ludo-flore-replay-player").remove();
		var	p = this,
			mode,
			savedMoves,
			timer;
		var $button = $('<button>').addClass('small ludo-flore-button')
		.text('replay')
		.click(function(){
			$button.hide();
			$player.show();
			savedMoves = p.g.moves;
			goToStart();
		});
		function restoreFromMoves(g){
			g.status = "running";
			g.scores = [0, 0];
			for (var i=0; i<T; i++) {
				for (var j=0; j<T; j++) {
					if (g.cells[i][j]!==NO_CELL) g.cells[i][j]=NO_PLAYER;
				}
			}
			Flore.restore(g);
			[].forEach.call(g.moves, function(cm){
				var move = Flore.decodeMove(cm);
				Flore.apply(g, move);
			});
		}
		function playMove(){
			if (savedMoves.length===p.g.moves.length) return pause();
			var	cm = savedMoves[p.g.moves.length],
				move = Flore.decodeMove(cm);
			p.g.moves += cm;
			Flore.apply(p.g, move);
			p.drawScores();
			p.drawBoard();
			if (mode==="playing") timer = setTimeout(playMove, 600);
		}
		function goToStart(){
			pause();
			p.g.moves = "";
			restoreFromMoves(p.g);
			p.s.empty();
			p.buildBoard();
			p.buildScores();
			p.drawScores();
			p.drawBoard();
		}
		function stepBackward(){
			p.g.moves = p.g.moves.slice(0, -1);
			restoreFromMoves(p.g);
			pause();
			p.s.empty();
			p.buildBoard();
			p.buildScores();
			p.drawScores();
			p.drawBoard();
		}
		function pause(){
			$play.show();
			$pause.hide();
			mode = "paused";
			clearTimeout(timer);
		}
		function run(){
			$pause.show();
			$play.hide();
			mode = "playing";
			if (p.g.moves===savedMoves) {
				p.g.moves = "";
			}
			restoreFromMoves(p.g);
			p.s.empty();
			p.buildBoard();
			p.buildScores();
			playMove();
		}
		function stepForward(){
			pause();
			playMove();
		}
		function goToEnd(){
			clearTimeout(timer);
			mode = "paused";
			p.g.moves = savedMoves;
			restoreFromMoves(p.g);
			p.drawScores();
			p.drawBoard();
		}
		function close(){
			goToEnd();
			$button.show();
			$player.hide();
		}
		var $player = $("<div>").addClass("ludo-flore-replay-player").hide();
		$("<button>").html("&#xe838;").appendTo($player).click(goToStart);
		var $pause = $("<button>").html("&#xe83c;").appendTo($player).click(pause).hide();
		var $play = $("<button>").html("&#xe835;").appendTo($player).click(run);
		$("<button>").html("&#xe83a;").appendTo($player).click(stepBackward);
		$("<button>").html("&#xe83b;").appendTo($player).click(stepForward);
		$("<button>").html("&#xe839;").appendTo($player).click(goToEnd);
		$("<button>").html("&#xe837;").appendTo($player).click(close);
		$player.add($button)
		.css({ position:"absolute", top:this.LHS*2.7, left:this.XS })
		.appendTo($c);
	}

	games.Flore = {
		render: function($c, m, g, abstract){
			Flore.restore(g);
			$c.empty().addClass('wide content-rating-not-serious').css('background', bg)
			.closest('.message').removeClass('edited');
			var	s = ù('<svg', $c),
				p = new Panel(m, g, s, $c.width(), abstract);
			s.width(p.W).height(p.H);
			$c.dat('ludo-panel', p);
			if (g.status !== "ask") m.locked = true;
			p.buildBoard();
			p.drawBoard();
			p.buildScores();
			p.drawScores();
			if (!abstract && !gui.mobile && p.g.status==="finished") {
				p.addReplayPlayer($c);
			}
			return p;
		},
		move: function($c, m, _, move){
			var panel = $c.dat('ludo-panel');
			if (!panel) {
				console.log("Missing ludo-panel for move", m.id, $c);
				return null;
			}
			var	movechar = Flore.encodeMove(move),
				newmove = panel.g.moves.slice(-1) !== movechar;
			m.locked = true;
			if (newmove) {
				panel.g.moves += movechar;
				Flore.apply(panel.g, move);
			}
			panel.drawBoard();
			panel.drawScores();
			if (!panel.abstract && !gui.mobile && panel.g.status==="finished") {
				panel.addReplayPlayer($c);
			}
			return newmove;
		},
		fillHelp: function($div){
			$div.css({
				background:'#2a4646', color: '#aadaaa', opacity:0.95
			}).append(
				$('<div>Flore</div>').css({
					textAlign:'center', fontSize:'120%', fontWeight:'bold', margin:'4px'
				})
			).append($('<p>').html(
				'When a flower is surrounded by more than three flowers,'+
				' it dies and the other player gains one point.<br>'+
				`First player with ${Flore.GOAL} points wins.<br>`+
				'To start a new game, just type <i>!!flore&nbsp;@somename</i>'
			));
		}
	}

});
