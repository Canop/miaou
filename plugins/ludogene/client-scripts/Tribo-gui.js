miaou(function(games, locals, notif, ws){

	var T = 10, // size of the board in cells (not expected to change)
		CS = 20, // size of a cell in pixels
		BR = CS/2-2, // radius of a board dot
		bg = "#4d8080",
		colors = ['SandyBrown', 'AntiqueWhite'];

	function Panel(m, g, s, availableWidth, abstract){
		this.m = m; // message
		this.g = g; // game
		this.s = s; // ùsvg
		this.u = -1; // user index in the game
		this.grads = colors.map(function(c){ return s.rgrad(0.3, 0.3, 1, c, '#000') });
		this.holeGrad = s.rgrad(0.3, 0.3, 1, 'rgba(0,0,0,0.5)', bg);
		g.players.forEach(function(p,i){ if (p.id===locals.me.id) this.u=i }, this);
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
		var x1 = this.XB+(line.x+0.5)*CS,
			y1 = this.YB+(line.y+0.5)*CS,
			x2 = line.d==='v' ? x1 : x1+CS*2,
			y2 = line.d==='h' ? y1 : y1+CS*2;
		return ù('<line').prependTo(this.s).attr({
			x1:x1, y1:y1, x2:x2, y2:y2,
			stroke:colors[p], strokeOpacity:0.6,
			strokeWidth:CS, strokeLinecap:'round'
		});
	}

	Panel.prototype.drawBoard = function(){
		if (this.abstract) return;
		var panel = this, s = this.s, cells = this.g.cells, XB = this.XB, YB = this.YB,
			userIsCurrentPlayer = panel.g.current!==-1 && panel.u===panel.g.current;
		for (var i=0; i<T; i++) {
			for (var j=0; j<T; j++) {
				(function(i,j){
					if (panel.holes[i][j]) panel.holes[i][j].remove();
					var cell = cells[i][j],
						c = panel.holes[i][j] = ù('<circle', s).attr({cx:XB+i*CS+CS/2, cy:YB+j*CS+CS/2, r:BR});
					if (cell===-1) {
						c.attr('fill', panel.holeGrad);
						var zone = panel.g.cellZone ? panel.g.cellZone[i][j] : null;
						if (zone && zone.owner!==undefined) {
							c = ù('<g', s).append(c);
							ù('<circle', c).attr({cx:XB+i*CS+(CS+1)/2, cy:YB+j*CS+(CS+1)/2, r:BR/2, fill:panel.grads[zone.owner]});
						}
						if (userIsCurrentPlayer) {
							if (Tribo.canPlay(panel.g, i, j, panel.u)) {
								var lines = Tribo.getLines(panel.g, i, j, panel.u) || [],
									lineMarks;
								c.on('mouseenter', function(){
									c.attr('fill', colors[panel.u]);
									lineMarks = lines.map(function(line){ return panel.lineMark(line, panel.u) });
								}).on('mouseleave click', function(){
									c.attr('fill', panel.holeGrad);
									for (var k=0; lineMarks && k<lineMarks.length; k++) lineMarks[k].remove();
								}).on('click', function(){
									ws.emit('ludo.move', {mid:panel.m.id, move:Tribo.encodeMove({p:panel.u, x:i, y:j})});
									notif.userAct();
								}).attr({cursor:'pointer'});
							} else {
								c.on('mouseenter', function(){ c.attr('fill', 'red') })
								.on('mouseleave', function(){ c.attr('fill', panel.holeGrad) });
							}
						}
					} else {
						c.attr('fill', panel.grads[cell]);
					}
				})(i,j);
			}
		}
	}

	Panel.prototype.buildScores = function(){
		var panel = this, s = panel.s, XS = this.XS, RS = this.RS;
		panel.names = panel.g.players.map(function(player, i){
			var name = player.name,
				attr = { x:XS, y:panel.LHS*(i+1), fill:colors[i] };
			if (!panel.abstract) attr.fontWeight = 'bold';
			return ù('<text', s).text(name.length>21 ? name.slice(0,18)+'…' : name).attr(attr);
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
		this.scores.forEach(function(s,i){ s.text(g.scores[i]) });
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
	
	Panel.prototype.showMoveLines = function(move) {
		if (!move.lines) return;
		move.lines.forEach(function(line){
			this.lineMark(line, move.p).animate({strokeOpacity:0}, 6000, ù.remove);
		}, this);
	}

	Panel.prototype.addReplayStopButton = function($c){
		var p = this,
			playing = false,
			savedMoves,
			$button,
			timer;
		if (p.g.status !== 'finished') return;
		function stop(){
			clearTimeout(timer);
			playing = false;
			$button.text('replay');
			p.g.moves = savedMoves;
			Tribo.restore(p.g);
			p.drawScores();
			p.drawBoard();
		}
		function playMove(){
			if (savedMoves.length===p.g.moves.length) return stop();
			var cm = savedMoves[p.g.moves.length],
				move = Tribo.decodeMove(cm);
			p.g.moves += cm;
			Tribo.apply(p.g, move);
			p.drawScores();
			p.drawBoard();
			p.showMoveLines(move);
			timer = setTimeout(playMove, 600);
		}
		$button = $('<button>').addClass('small').css({
			background:'#2a4646', color:'white'
		}).text('replay')
		.css({ position:"absolute", top:this.LHS*2.7, left:this.XS }).appendTo($c)
		.click(function(){
			if (!playing) {
				playing = true;
				savedMoves = p.g.moves;
				$(this).text('stop replay');
				p.g.moves = "";
				p.g.zones = [];
				p.g.cellZone = null;
				Tribo.restore(p.g);
				p.s.empty();
				p.buildBoard();
				p.buildScores();
				playMove();
			} else {
				stop();
			}
		});
	}

	games.Tribo = {
		render: function($c, m, g, abstract){
			Tribo.restore(g);
			$c.empty().addClass('wide').css('background', bg).closest('.message').removeClass('edited');
			var s = ù('<svg', $c),
				p = new Panel(m, g, s, $c.width(), abstract);
			s.width(p.W).height(p.H);
			$c.data('ludo-panel', p);
			if (g.status !== "ask") m.locked = true;
			p.buildBoard();
			p.drawBoard();
			p.buildScores();
			p.drawScores();
			if (!abstract) {
				p.addReplayStopButton($c);
			}
		},
		move: function($c, m, _, move){
			// moves, like messages, can be received more than once
			// so game implementations must detect that.
			// move returns true if the player should be notified
			var panel = $c.data('ludo-panel'),
				movechar = Tribo.encodeMove(move),
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
				panel.addReplayStopButton($c);
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
