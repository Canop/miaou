(function(){
	var W = 400, H = 220, // size of the whole drawed area
		T = 10, // size of the board in cells (not expected to change)
		CS = 20, // size of a cell in pixels
		XB = (W - T*CS), YB = (H - T*CS)/2,
		BR = CS/2-2, // radius of a board dot
		NB_ZONES_MAX = T * T / 8,
		bg = Snap.hsb(.5, .4, .5);
	
	function Panel(m, g, s){
		this.m = m;
		this.g = g; // game
		this.s = s; // snap thing
		this.u = -1;
		this.colors = ['yellow', 'purple'];
		this.grads = this.colors.map(function(c){ return s.gradient("r(0.3,0.3,1)"+c+"-(0,0,0)") });
		g.players.forEach(function(p,i){ if (p.id===me.id) this.u=i }, this);
		this.holeGrad = s.gradient("r(0.3,0.3,1)rgba(0,0,0,0.5)-"+bg)
	}

	Panel.prototype.buildBoard = function(){
		var panel = this, s = this.s;
		panel.holes = [];
		for (var i=0; i<T; i++) {
			panel.holes[i] = [];
			for (var j=0; j<T; j++) {
			//	panel.holes[i][j] = s.circle(XB+i*CS+CS/2, YB+j*CS+CS/2, BR);
			}
		}
	}
	
	Panel.prototype.drawBoard = function(){
		var panel = this, s = this.s, holeColor = Snap.hsb(.5, .4, .7), cells = this.g.cells;
		for (var i=0; i<T; i++) {
			for (var j=0; j<T; j++) {
				(function(i,j){
					if (panel.holes[i][j]) panel.holes[i][j].remove(); // it seems you can't change attributes of elements using snapsvg 
					var cell = cells[i][j],
						c = panel.holes[i][j] = s.circle(XB+i*CS+CS/2, YB+j*CS+CS/2, BR);
					if (cell===-1) {
						c.attr({fill: panel.holeGrad});	
						if (panel.u === panel.g.current) {
							if (Tribo.canPlay(panel.g, i, j, panel.u)) {
								// TODO show differently from a filled cell
								// TODO point lines of 3
								c.attr({cursor:'pointer'})
								.hover(function(){
									c.attr({fill: panel.colors[panel.u]});
								},function(){
									c.attr({fill: panel.holeGrad});						
								}).click(function(){
									miaou.socket.emit('ludo.move', {mid:panel.m.id, move:Tribo.encodeMove({p:panel.u, x:i, y:j})});
								});
							} else {
								// TODO show why cell isn't playable in a bubble
								// TODO red cross
								c.hover(function(){
									c.attr({fill: 'red'});
								},function(){
									c.attr({fill: panel.holeGrad});						
								}).click(function(){
									miaou.socket.emit('ludo.move', {mid:panel.m.id, move:Tribo.encodeMove({p:panel.u, x:i, y:j})});
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
	

	if (!miaou.games) miaou.games = {};
	miaou.games.Tribo = {
		render: function($c, m, g){
			var id = 'ludo_'+m.id;
			$c.empty().css('background', bg).closest('.message').removeClass('edited');
			$s = $('<svg id='+id+'></svg>').width(W).height(H).appendTo($c);
			Tribo.restore(g);
			var s = Snap('#'+id), // <- there's probably something cleaner, I don't know snapsvg well enoug
				p = new Panel(m, g, s);
			$c.data('tribo-panel', p);
			p.buildBoard();
			p.drawBoard();
		}, move: function($c, m, game, move){
			var panel = $c.data('tribo-panel');
			Tribo.apply(panel.g, move);
			panel.drawBoard();
		}
	}
})();
