// renders tables as bar graphs in messages containing #graph
// Right now, this isn't terribly generic. I'll make it more capable
// if the need arises

miaou(function(md, plugins){

	ù.fn.textpos = function(str, x, y, align, fs){
		this.text(str).attr({x:x, y:y, textAnchor:align||"middle", alignmentBaseline:"middle"});
		if (fs) this.attr('font-size', fs+'em');
		return this;
	}

	function TGCol($table, i){
		this.rawvals = $table.find('tr td:nth-child('+(i+1)+')').map(function(){
			return $(this).text();
		}).get();
		this.name = $table.find('th:nth-child('+(i+1)+')').text();
		this.vals;
		this.valid = false;
	}
	TGCol.prototype.parse = function(parser){
		var vals = new Array(this.rawvals.length);
		for (var i=0; i<this.rawvals.length; i++) {
			vals[i]=parser(this.rawvals[i]);
			if (vals[i]===undefined) return;
		}
		this.vals = vals;
		this.valid = true;
	}
	TGCol.prototype.isAscending = function(){
		for (var i=0, n=this.vals.length; i<n; i++) {
			if ( !(this.vals[i].end > this.vals[i].start) || (i && (this.vals[i-1].end > this.vals[i].start)) ) {
				console.log("not ascending");
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

	var nm3 = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
	var m3 = {};
	for (var i=0; i<nm3.length; i++) m3[nm3[i]]=i+1;
	var xparsers = [
		function(s){ // jun 2015
			var m = s.match(/^(\w+)[\s\/\-]+(\d{4})$/);
			if (!m) return;
			var month = m3[m[1].toLowerCase()];
			return {
				start:(new Date(+m[2], month-1)).getTime(),
				end:(new Date(+m[2], month)).getTime(),
				label:m[1]+' '+m[2]
			};
		},
		function(s){ // 201506 or 2015/06
			var m = s.match(/^(\d{4})\s*(?:\/\s*)?(\d{2})$/);
			if (!m) return;
			return {
				start: (new Date(+m[1], m[2]-1)).getTime(),
				end: (new Date(+m[1], m[2])).getTime(),
				label: nm3[(new Date(+m[1], m[2]-1)).getMonth()]+' '+m[1]
			};
		},
		function(s){ // small sequential integers
			var d = parseInt(s);
			if (d!==d) return;
			return {
				start: d-.5,
				end: d+.5,
				label: s
			};
		}
	];
	var colors = [
		'#e9967a', 'rgba(0,143,143,.4)', 'rgba(251, 170, 5, .4)',
		'rgba(251, 237, 5, .5)', 'rgba(188,143,143,0.35)',
		'rgba(180, 237, 228, .45)', 'rgba(192, 169, 244, .45)', 'rgba(160, 5, 5, .3)',
		'rgba(176,224,230,0.32)', 'rgba(255,255,102,0.3)', 'rgba(255,35,215,0.3)'
	];
	var pop;
	function hidePop(){
		if (pop) pop.remove();
	}

	function render($c, m){
		if (!m.content || !/(^|\s)#graph\b/.test(m.content)) return;

		var $table = $c.find('table').eq(0);
		if (!$table.length) return;
		var	xcol = new TGCol($table, 0),
			ycols = [];
		for (var ip=0; ip<xparsers.length; ip++) {
			xcol.parse(xparsers[ip]);
			if (xcol.valid) {
				if (xcol.isAscending()) break;
				else xcol.valid = false; // not valid as a x column
			}
		}
		if (!xcol.valid) {
			console.log("table : no valid x column", xcol);
			return;
		}

		for (var i=1, nbcols=$table.find('tr:first-child th').length; i<nbcols; i++) {
			var ycol = new TGCol($table, i);
			ycol.parse(Number);
			if (ycol.valid && ycol.hasDifferentValues()) ycols.push(ycol);
		}

		var	H = 170,
			nbycols = ycols.length;

		if (!nbycols) {
			console.log("no value column for #graph");
			return;
		}

		var	xvals = xcol.vals,
			maxXLabelLength = Math.max.apply(0, xvals.map(function(xv){ return xv.label.length })),
			rotateXLabels = maxXLabelLength > 5,
			mt = 2, // margin top
			mr = 5, // margin right
			mb = 60, // margin bottom
			ml = rotateXLabels ? 35 : 5, // margin left
			n = xvals.length,
			g = ù('<svg', $c[0]).css({ height:H, width:600 }),
			gW = Math.max(50, Math.min(g.width()-mr-ml, 40*n*ycols.length)),
			W = gW+mr+ml,
			xmin = xvals[0].start,
			w = W-ml-mr, h = H-mt-mb,
			rx = w / (xvals[n-1].end-xvals[0].start);

		ycols.forEach(function(ycol, j){
			ycol.max = Math.max.apply(0, ycol.vals);
			ycol.min = Math.min.apply(0, ycol.vals);
			if (ycol.min>0 && ycol.min<.9*ycol.max) ycol.min = 0;
			ycol.r = h / (ycol.max-ycol.min);
			ycol.color = colors[j%colors.length];
		});
		xvals.forEach(function(xval, i){
			var	x1 = Math.floor(ml+(xvals[i].start-xmin)*rx)+2,
				x2 = ml+(xvals[i].end-xmin)*rx-3,
				xm = (x1+x2)/2,
				barWidth = Math.floor((x2-x1-5)/nbycols);
			var showPop = function(){
				var l = 70;
				if (xm-l<10) l = 10;
				else if (xm+l>W-10) l = 135;
				var path = "M "+(xm)+" "+(mt+h-5.5)
					+ " l 10 10"
					+ " h "+(140-l)
					+ " v 52"
					+ " h -160"
					+ " v-52"
					+ " h "+l
					+ " l 10 -10";
				var xmr = xm + 70 - l;
				pop = ù("<g", g).attr({
					alignmentBaseline:"middle", fontSize:"85%"
				});
				ù('<path', pop).attr({d:path, fill:"#eee", stroke:"#aaa", strokeWidth:1});
				ù('<text', pop).text(xval.label).attr({
					x:xmr, y:mt+h+19, textAnchor:"middle"
				});
				ycols.forEach(function(ycol, j){
					ù('<rect', pop).attr({
						x:xmr-70, width:6, y:mt+h+28+j*16, height:6,
						fill:ycol.color
					});
					ù('<text', pop).text(ycol.name+": "+ycol.rawvals[i]).attr({
						x:xmr-58, y:mt+h+35+j*16
					});
				});
			}
			ycols.forEach(function(ycol, j){
				var	val = ycol.vals[i],
					y = mt + h - Math.floor((val-ycol.min)*ycol.r),
					height = Math.ceil(h-y+mt),
					xbar = x1+(barWidth+2)*j+4;
				ù('<rect', g).attr({
					x:xbar, y:y, width:barWidth, height:height,
					fill:ycol.color
				});
			});
			var	x = xm,
				y = h+mt+10;
			var text = ù('<text', g).text(xval.label).attr({
				x:x, y:y, alignmentBaseline:"middle", fontSize:"85%", opacity:.9
			});
			if (rotateXLabels) {
				text.attr({textAnchor:"end", transform:"rotate(-45 "+x+" "+y+")"});
			}
			ù('<rect', g).attr({
				x:x1, width:x2-x1, y:0, height:h, fill:"transparent", cursor:'crosshair'
			}).on('mouseenter', showPop).on('mouseleave', hidePop);
			ù('<line', g).attr({
				x1:x1-.5, x2:x1-.5, y1:mt+h-2, y2:mt+h+1,
				stroke:"#666", strokeWidth:1
			});
		});

		var $tablewrap = $table.closest('.tablewrap');
		$('<div>').addClass('graph-tbl-wrapper').insertBefore($tablewrap)
		.append($tablewrap).append(g.n);
	}

	plugins.graph = {
		start: function(){
			md.registerRenderer(render, true);
		}
	}

});


