miaou(function(games, gui, locals, notif, skin, ws){

	var	T = 10, // size of the board in cells (not expected to change)
		CS = 20, // size of a cell in pixels
		BR = CS/2-2, // radius of a board dot
		bg = skin.getCssValue(/^\.ludo-tribo-board-bg$/, 'background-color'),
		Tribo = window.Tribo,
		colors = ['SandyBrown', 'AntiqueWhite'];

	function Panel(m, g, s, availableWidth, abstract){
		this.m = m; // message
		this.g = g; // game
		this.s = s; // ùsvg
		this.u = -1; // user index in the game
		this.grads = colors.map(function(c){ return s.rgrad(0.3, 0.3, 1, c, '#000') });
		this.holeGrad = s.rgrad(0.3, 0.3, 1, 'rgba(0,0,0,0.5)', bg);
		g.players.forEach(function(p, i){ if (p.id===locals.me.id) this.u=i }, this);
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
			this.H = 215; // height of the whole drawed area
			this.XB = (this.W - T*CS); // X of the board
			this.RS = this.XB - 15; // right of the scores
			this.YB = (this.H - T*CS)/2; // Y of the boead
			this.XS = Math.max(20, this.XB-194);
			this.LHS = 28; // height of a score line
		} else {
			// column layout's reason d'etre is the mobile version of miaou
			this.layout = "column";
			this.W = T*CS;
			this.W += Math.max(4, (availableWidth-this.W)/2);
			this.H = 280;
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

	Panel.prototype.lineMark = function(line, p){
		var	x1 = this.XB+(line.x+0.5)*CS,
			y1 = this.YB+(line.y+0.5)*CS,
			x2 = line.d==='v' ? x1 : x1+CS*2,
			y2 = line.d==='h' ? y1 : y1+CS*2;
		return ù('<line').prependTo(this.s).attr({
			x1:x1, y1:y1, x2:x2, y2:y2,
			stroke:colors[p], strokeOpacity:0.6,
			strokeWidth:CS, strokeLinecap:'round'
		});
	}

	Panel.prototype.drawCell = function(i, j){
		var	cell = this.g.cells[i][j],
			panel = this,
			s = this.s,
			userIsCurrentPlayer = panel.g.current!==-1 && panel.u===panel.g.current;
		if (panel.holes[i][j]) panel.holes[i][j].remove();
		var	c = panel.holes[i][j] = ù('<circle', s).attr({cx:this.XB+i*CS+CS/2, cy:this.YB+j*CS+CS/2, r:BR});
		if (cell!==-1) {
			c.attr('fill', panel.grads[cell]);
			return;
		}
		c.attr('fill', panel.holeGrad);
		var zone = panel.g.cellZone ? panel.g.cellZone[i][j] : null;
		if (zone && zone.owner!==undefined) {
			c = ù('<g', s).append(c);
			ù('<circle', c).attr({
				cx:this.XB+i*CS+(CS+1)/2, cy:this.YB+j*CS+(CS+1)/2, r:BR/2, fill:panel.grads[zone.owner]
			});
		}
		if (!userIsCurrentPlayer) return;
		if (Tribo.canPlay(panel.g, i, j, panel.u)) {
			var	lines = Tribo.getLines(panel.g, i, j, panel.u) || [],
				lineMarks;
			c.on('mouseenter', function(){
				c.attr('fill', colors[panel.u]);
				lineMarks = lines.map(function(line){
					return panel.lineMark(line, panel.u)
				});
			}).on('mouseleave click', function(){
				c.attr('fill', panel.holeGrad);
				for (var k=0; lineMarks && k<lineMarks.length; k++) {
					lineMarks[k].remove();
				}
			}).on('click', function(){
				ws.emit('ludo.move', {
					mid: panel.m.id,
					move: Tribo.encodeMove({p:panel.u, x:i, y:j})
				});
				notif.userAct();
			}).attr({cursor:'pointer'});
		} else {
			c.on('mouseenter', function(){ c.attr('fill', 'red') })
			.on('mouseleave', function(){ c.attr('fill', panel.holeGrad) });
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
			var move = Tribo.decodeMove(this.g.moves.charAt(i));
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
			.attr({ x:XS, y:panel.LHS*(i+1), fill:colors[i] });
			if (!panel.abstract) {
				text.on('mouseenter', panel.drawLastMoves.bind(panel, i))
				.on('mouseleave', panel.removeLastMoves.bind(panel))
				.attr({ fontWeight:'bold', cursor:"help" });
			}
			return text;
		});
		panel.scores = panel.g.players.map(function(player, i){
			return ù('<text', s).text('0').attr({
				x:RS, y:panel.LHS*(i+1), fill:colors[i],
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

	Panel.prototype.showMoveLines = function(move){
		if (!move.lines) return;
		move.lines.forEach(function(line){
			this.lineMark(line, move.p).animate({strokeOpacity:0}, 6000, ù.remove);
		}, this);
	}

	Panel.prototype.addReplayPlayer = function($c){
		$c.find(".ludo-tribo-button, .ludo-tribo-replay-player").remove();
		var	p = this,
			mode,
			savedMoves,
			timer;
		var $button = $('<button>').addClass('small ludo-tribo-button')
		.text('replay')
		.click(function(){
			$button.hide();
			$player.show();
			savedMoves = p.g.moves;
			goToStart();
		});
		function playMove(){
			if (savedMoves.length===p.g.moves.length) return pause();
			var	cm = savedMoves[p.g.moves.length],
				move = Tribo.decodeMove(cm);
			p.g.moves += cm;
			Tribo.apply(p.g, move);
			p.drawScores();
			p.drawBoard();
			p.showMoveLines(move);
			if (mode==="playing") timer = setTimeout(playMove, 600);
		}
		function goToStart(){
			pause();
			p.g.moves = "";
			p.g.zones = [];
			p.g.cellZone = null;
			Tribo.restore(p.g);
			p.s.empty();
			p.buildBoard();
			p.buildScores();
			p.drawScores();
			p.drawBoard();
		}
		function stepBackward(){
			p.g.moves = p.g.moves.slice(0, -1);
			Tribo.restore(p.g);
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
				p.g.zones = [];
				p.g.cellZone = null;
			}
			Tribo.restore(p.g);
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
			Tribo.restore(p.g);
			p.drawScores();
			p.drawBoard();
		}
		function close(){
			goToEnd();
			$button.show();
			$player.hide();
		}
		var $player = $("<div>").addClass("ludo-tribo-replay-player").hide();
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

	games.Tribo = {
		render: function($c, m, g, abstract){
			Tribo.restore(g);
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
			// moves, like messages, can be received more than once
			// so game implementations must detect that.
			// move returns true if the player should be notified
			var	panel = $c.dat('ludo-panel');
			if (!panel) {
				console.log("Missing ludo-panel for move", m.id, $c);
				return null;
			}
			var	movechar = Tribo.encodeMove(move),
				newmove = panel.g.moves.slice(-1) !== movechar;
			m.locked = true;
			if (newmove) {
				panel.g.moves += movechar;
				Tribo.apply(panel.g, move);
			}
			panel.drawBoard();
			panel.drawScores();
			if (!panel.abstract) {
				panel.showMoveLines(move);
			}
			if (!panel.abstract && !gui.mobile && panel.g.status==="finished") {
				panel.addReplayPlayer($c);
			}
			return newmove;
		},
		fillHelp: function($div){
			$div.css({
				background:'#2a4646', color: '#ece4cb', opacity:0.95
			}).append(
				$('<div>Tribo</div>').css({
					textAlign:'center', fontSize:'120%', fontWeight:'bold', margin:'4px'
				})
			).append($('<p>').html(
				'Try to fill or reserve the biggest part of the board.<br>'+
				'When you make a vertical or horizontal line of <i>exactly<i> 3 coins (no more), you play again.<br>'+
				'To start a new game, just type <i>!!tribo&nbsp;@somename</i>'
			));
		}
	}

});
