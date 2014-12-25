// This is a temporary implementation for the Flore GUI
// Hopefully I'll have a prettier rendering

miaou(function(games, locals, ws){

	if (typeof Snap === 'undefined') return; // this file is part of the big minified file imported in all miaou pages, even the ones not importing snap-svg

	var T = 8, // FIXME duplication with Flore.js
		NO_CELL = -2,
		CS = 24, // size of a cell in pixels
		BR = CS/2-2, // radius of a board dot
		bg = Snap.hsb(.2, .7, .3),
		boardCount = 0;

	function Panel(m, g, s, availableWidth, abstract){
		this.m = m;
		this.g = g; // game
		this.s = s; // snap thing
		this.u = -1; // user index in the game
		this.colors = ['FloralWhite', 'LightPink'],
		this.grads = this.colors.map(function(c){ return s.gradient("r(0.3,0.3,1)"+c+"-(0,0,0)") });
		g.players.forEach(function(p,i){ if (p.id===locals.me.id) this.u=i }, this);
		this.holeGrad = s.gradient("r(0.3,0.3,1)rgba(0,0,0,0.5)-"+bg);
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
			this.YB = (this.H - T*CS)/2;
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
		return this.s.rect(
			this.XB+line.x*CS, this.YB+line.y*CS,
			line.d==='v' ? CS : CS*3,
			line.d==='h' ? CS : CS*3,
			CS/2, CS/2
		).attr({fill:this.colors[p], fillOpacity:0.6}).prependTo(this.s);
	}

	Panel.prototype.drawBoard = function(){
		if (this.abstract) return;
		var panel = this, s = this.s, cells = this.g.cells, XB = this.XB, YB = this.YB,
			userIsCurrentPlayer = panel.g.current!==-1 && panel.u===panel.g.current;
		for (var i=0; i<T; i++) {
			for (var j=0; j<T; j++) {
				if (cells[i][j]===NO_CELL) continue;
				(function(i,j){
					if (panel.holes[i][j]) panel.holes[i][j].remove();
					var cell = cells[i][j],
						c = panel.holes[i][j] = s.circle(XB+i*CS+CS/2, YB+j*CS+CS/2, BR);
					if (cell===-1) {
						c.attr({fill: panel.holeGrad});
						if (userIsCurrentPlayer) {
							if (Flore.canPlay(panel.g, i, j)) {
								c.attr({cursor:'pointer'}).hover(
									function(){
										c.attr({fill: panel.colors[panel.u]});
									},
									function(){
										c.attr({fill: panel.holeGrad});
									}
								).click(function(){
									ws.emit('ludo.move', {mid:panel.m.id, move:Flore.encodeMove({p:panel.u, x:i, y:j})});
								});
							} else { // hum... je pense que c'est une branche morte, ça...
								c.hover(
									function(){ c.attr({fill: 'red'}) },
									function(){	c.attr({fill: panel.holeGrad}) }
								).click(function(){
									ws.emit('ludo.move', {mid:panel.m.id, move:Flore.encodeMove({p:panel.u, x:i, y:j})});
								});
							}
						}
					} else {
						c.attr({fill:panel.grads[cell]});
					}
				})(i,j);
			}
		}
	}

	Panel.prototype.buildScores = function(){
		var panel = this, s = panel.s, XS = this.XS, RS = this.RS;
		panel.names = panel.g.players.map(function(player, i){
			var name = player.name,
				attr = { fill:panel.colors[i] };
			if (!panel.abstract) attr.fontWeight = 'bold';
			return s.text(XS, panel.LHS*(i+1), name.length>21 ? name.slice(0,18)+'…' : name).attr(attr);
		});
		panel.scores = panel.g.players.map(function(player, i){
			return s.text(RS, panel.LHS*(i+1), '0').attr({
				fill: panel.colors[i],
				fontWeight: 'bold', textAnchor: 'end'
			})
		});
	}

	Panel.prototype.drawScores = function(){
		this.scores[0].node.innerHTML = (this.g.scores[0]); // Q : what's the proper way to do this using snapsvg ?
		this.scores[1].node.innerHTML = (this.g.scores[1]);
		if (this.currentPlayerMark) this.currentPlayerMark.remove();
		if (this.g.current >= 0) {
			this.currentPlayerMark = this.s.text(this.XS-15, this.LHS*(this.g.current+1), "►").attr({
				fill: this.grads[this.g.current], fontWeight: 'bold'
			})
		} else {
			this.currentPlayerMark = this.s.text(this.XS-18, this.LHS*((this.g.scores[1]>this.g.scores[0])+1), "♛").attr({
				fill: "Goldenrod", fontWeight: 'bold', fontSize: "140%"
			})
		}
	}

	games.Flore = {
		render: function($c, m, g, abstract){
			Flore.restore(g);
			$c.empty().css('background', bg).closest('.message').removeClass('edited');
			var id = 'flore_board_'+ boardCount++,
				$s = $('<svg id='+id+'></svg>').appendTo($c),
				s = Snap('#'+id), // <- there's probably something cleaner when you have the element, I don't know snapsvg well enough
				p = new Panel(m, g, s, $c.width(), abstract);
			$s.width(p.W).height(p.H);
			$c.data('ludo-panel', p);
			if (g.status !== "ask") m.locked = true;
			p.buildBoard();
			p.drawBoard();
			p.buildScores();
			p.drawScores();
		},
		move: function($c, m, _, move){
			var panel = $c.data('ludo-panel');
			m.locked = true;
			panel.g.moves += Flore.encodeMove(move);
			Flore.apply(panel.g, move);
			panel.drawBoard();
			panel.drawScores();
		},
		fillHelp: function($div){
			$div.css({
				background:'#2a4646', color: '#0c0', opacity:0.95
			}).append(
				$('<div>Flore</div>').css({
					textAlign:'center', fontSize:'120%', fontWeight:'bold', margin:'4px'
				})
			).append($('<p>').html(
				'When a flower is surrounded by more than three flowers, it dies and the other player gains one point.<br>'+
				'First player with ten points wins.<br>'+
				'To start a new game, just type <i>!!flore&nbsp;@somename</i>'
			));
		}
	}

});
