// renders tables as bar graphs in messages containing #graph

miaou(function(md, plugins){

	ù.fn.textpos = function(str, x, y, align, fs){
		this.text(str).attr({x:x, y:y, textAnchor:align||"middle", alignmentBaseline:"middle"});
		if (fs) this.attr('font-size', fs+'em');
		return this;
	}

	function TGCol($table, i){
		this.rawvals = $table.find('tr td:nth-child('+(i+1)+')').map(function(){ return $(this).text() }).get();
		this.name = $table.find('th:nth-child('+(i+1)+')').text();
		this.vals;
		this.valid = false;
	}
	TGCol.prototype.parse = function(parser){
		var vals = new Array(this.rawvals.length);
		for (var i=0; i<this.rawvals.length; i++){
			vals[i]=parser(this.rawvals[i]);
			if (vals[i]===undefined) return;
		}
		this.vals = vals;
		this.valid = true;
	}
	TGCol.prototype.isAscending = function(){
		for (var i=0, n=this.vals.length; i<n; i++) {
			if ( !(this.vals[i][1]>this.vals[i][0]) || (i && (this.vals[i-1][1]>this.vals[i][0])) ) {
				return false;
			}
		}
		return true;
	}
	TGCol.prototype.hasDifferentValues = function(){
		var v = this.vals[0];
		for (var i=1, n=this.vals.length; i<n; i++) {
			if ( this.vals[i]!=v ) return true;
		}
		return false;
	}

	var m3 = {
		jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12	
	}
	var xparsers = [ // todo use a proper date parser (but lighter than moment.js)
		function(s){ // jun 2015
			var m = s.match(/^(\w+)[\s\/\-]+(\d{4})$/);
			if (!m) return;
			var month = m3[m[1].toLowerCase()];
			return [(new Date(+m[2], month-1)).getTime(), (new Date(+m[2], month)).getTime()];
		},
		function(s){ // 201506
			var m = s.match(/^(\d{4})\s*(\d{2})$/);
			if (!m) return;
			return [(new Date(+m[1], m[2]-1)).getTime(), (new Date(+m[1], m[2])).getTime()];
		},
	];
	//~ var colors = [
		//~ '#d5bdab', '#98d1d1', '#fcdc9a',
		 //~ '#fcf581', '#e7d7d7',
		 //~ '#dcf6f2', '#d0bcf9', '#e2b3b3',
		//~ '#fefed0', '#febcf2'
	//~ ];
	var colors = [
		'rgba(139, 69, 19, .35)', 'rgba(0,143,143,.4)', 'rgba(251, 170, 5, .4)',
		 'rgba(251, 237, 5, .5)', 'rgba(188,143,143,0.35)',
		 'rgba(180, 237, 228, .45)', 'rgba(192, 169, 244, .45)', 'rgba(160, 5, 5, .3)',
		'rgba(176,224,230,0.32)', 'rgba(255,255,102,0.3)', 'rgba(255,35,215,0.3)'
	];
	
	function render($c, m){
		if (m.content && /(^|\s)#graph\b/.test(m.content)) {
			var $table = $c.find('table').eq(0);
			if ($table.length!==1) return;
			var	xcol = new TGCol($table, 0),
				ycols = [];
			for (var ip=0; ip<xparsers.length; ip++){
				xcol.parse(xparsers[ip]);
				if (xcol.valid) {
					if (xcol.isAscending()) break;
					else xcol.valid = false; // not valid as a x column
				}
			}
			if (!xcol.valid) {
				console.log("table : no valid x column");
				return;
			}
			
			for (var i=1, nbcols=$table.find('tr:first-child th').length; i<nbcols; i++) {
				var ycol = new TGCol($table, i);
				ycol.parse(Number);
				if (ycol.valid && ycol.hasDifferentValues()) ycols.push(ycol);
			}

			var H = 150,
				nbycols = ycols.length;
			
			if (!nbycols) {
				console.log("no value column for #graph");
				return;
			}

			var ml = Math.min(70, nbycols*35),
				xvals = xcol.vals, 
				n = xvals.length,
				mt = 15, mr = 20, mb = 30, ml = 100; // margins top, right, bottom and left

			var g = ù('<svg',$c[0]).css({ height:H, width:600 }),
				gW = Math.max(50, Math.min(g.width()-mr-ml, 40*n*ycols.length)),
				W = gW+mr+ml, oc = "black",
				xmin = xvals[0][0],
				w = W-ml-mr, h = H-mt-mb;
			var	rx = w / (xvals[n-1][1]-xvals[0][0]);
			var txtx, txty, barborder;

			ycols.forEach(function(ycol, j){
				ycol.max = Math.max.apply(0, ycol.vals);
				ycol.min = Math.min.apply(0, ycol.vals);
				if (ycol.min<.6*ycol.max) ycol.min = 0;
				ycol.r = h / (ycol.max-ycol.min);
				ycol.color = colors[j%colors.length];
				ù('<text', g).textpos(ycol.name, ml-4, H/2-20*nbycols+j*20, "end").attr('fill', ycol.color);
				if (ml/nbycols>30) {
					var x = (j+.5)*ml/nbycols;
					ù('<text', g).textpos(ycol.min, x, H-30, "middle", .8).attr('fill', ycol.color);
					ù('<text', g).textpos(ycol.max, x, 8, "middle", .8).attr('fill', ycol.color);
				}
			});
			xvals.forEach(function(xval, i){
				var x1 = Math.floor(ml+(xvals[i][0]-xmin)*rx),
					x2 = ml+(xvals[i][1]-xmin)*rx-1,
					barWidth = Math.floor((x2-x1-1)/nbycols);
				ycols.forEach(function(ycol, j){
					var val = ycol.vals[i],
						y = mt + h - Math.floor((val-ycol.min)*ycol.r),
						height = Math.ceil(h-y+mt),
						xbar = x1+barWidth*j;
					ù('<rect', g).attr({
						x:xbar, y:y, width:barWidth, height:height,
						fill:ycol.color, cursor:'crosshair'
					}).on('mouseenter', function(){
						barborder = ù('<rect').attr({
							x:xbar, y:y, width:barWidth, height:height,
							fill:"transparent", stroke:oc, strokeWidth:1
						}).prependTo(g);
						//ù(this).attr({fill:oc});
						txty = ù('<text', g).textpos(val, xbar+barWidth*.5, 10).attr('fill', oc);
						txtx = ù('<text', g).textpos(xcol.rawvals[i], (x1+x2)*.5, H-18).attr('fill', oc);			
					}).on('mouseleave', function(){
						//ù(this).attr({fill:ycol.color});
						barborder.remove();
						txty.remove();
						txtx.remove();
					});
				});
			});

			ù('<text', g).textpos(xcol.rawvals[0], ml+2, H-5, "start", .8);
			ù('<text', g).textpos(xcol.rawvals[n-1], W-2-mr, H-5, "end", .8);
			var $tablewrap = $table.closest('.tablewrap');
			$('<div>').addClass('graph-tbl-wrapper').insertBefore($tablewrap)
			.append($tablewrap).append(g.n);
		}
	}
	
	plugins.graph = {
		start: function(){
			md.registerRenderer(render, true);
		}
	}

});


