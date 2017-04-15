// wzin($element1, $element2, someOpts) creates a visible link between the two elements
// Used to show the relation between an edited message and the input, or between a reply
//  icon and the replied to message.

window.wzin = (function(){

	var nextId = 0;

	function Wzin(e1, e2, opts){
		this.id = nextId++;
		this.e1 = e1;
		this.e2 = e2;
		this.fill = opts.fill||"black";
		this.zIndex = opts.zIndex||1;
		this.bindings = [];
		this.side = opts.side||"left";
		if (opts.scrollable) this.bind($(opts.scrollable), 'scroll', Wzin.prototype.update);
		this.parent = opts.parent || opts.scrollable || document.body;
		this.chbg = !!opts.changeElementBackground;
		this.bind($(window), 'resize', Wzin.prototype.update);
		this.update();

		if (opts.observe) {
			this.observer = new MutationObserver(this.update.bind(this));
			this.observer.observe(e1[0]||e1, {attributes:true, subtree:true, characterData:true});
			this.observer.observe(e2[0]||e2, {attributes:true, subtree:true, characterData:true});
		}
	}
	Wzin.prototype.bind = function(jqobj, eventtype, fun){
		fun = fun.bind(this);
		this.bindings.push([jqobj, eventtype, fun]);
		jqobj.on(eventtype, fun);
	}

	Wzin.prototype.remove = function(){
		this.svg.remove();
		if (this.observer) this.observer.disconnect();
		while (this.bindings.length) {
			var args = this.bindings.shift();
			args[0].off(args[1], args[2]);
		}
		if (this.savedBg) {
			this.e1.css({background:this.savedBg[0]});
			this.e2.css({background:this.savedBg[1]});
		}
	}

	Wzin.prototype.update = function(){
		var e1, e2; // inside this function, e1 is the topmost of this.e1 and this.e2
		if (this.e1.offset().top<=this.e2.offset().top) {
			e1 = this.e1; e2 = this.e2;
		} else {
			e1 = this.e2; e2 = this.e1;
		}

		if (this.svg) {
			this.svg.remove();
		} else if (this.chbg) {
			this.savedBg = [this.e1.css('background'), this.e2.css('background')];
			$().add(e1).add(e2).css({background:this.fill});
		}
		var	p1 = e1.offset(), h1 = e1.outerHeight(), w1 = e1.outerWidth(),
			p2 = e2.offset(), h2 = e2.outerHeight(), w2 = e2.outerWidth(),
			H = Math.max(p2.top+h2, p1.top+h1) - p1.top,
			S = 100, // width of the wzin itself (the external curve, without the elements)
			s = 40,  // width of the internal curve
			ps = {
				top: p1.top,
				left: Math.min(p1.left, p2.left)
			},
			W = S + Math.max(w1, w2);
		if (this.side==="left") {
			ps.left -= S;
		}

		p1.left -= ps.left; p1.top -= ps.top;
		p2.left -= ps.left; p2.top -= ps.top;
		var	pl = Math.min(p1.left, p2.left),
			antitwist = Math.abs(p1.left-p2.left) > p2.top-p1.top-h1;

		var	path,
			l1 = p1.left,
			l2 = p2.left,
			B1 = p1.top+h1,
			B2 = p2.top+h2,
			B = Math.max(B2, B1);
		if (this.side==="left") {
			path = "M "+l1+' '+p1.top;
			if (antitwist) {
				path += " H "+pl;
				path += " C "+(pl-S)+' '+p1.top+ ', '+(pl-S)+' '+B2+ ', '+pl+' '+B;
				path += " H "+l2;
				path += " V "+p2.top;
				path += " H "+pl;
				var dx = Math.min(s, p2.top-p1.top-h1+10);
				path += " C "+(pl-dx)+' '+(p2.top)+ ', '+(pl-dx)+' '+B1+ ', '+l1+' '+B1;
			} else {
				path += " C "+(pl-S)+' '+p1.top+ ', '+(pl-S)+' '+B2+ ', '+l2+' '+B;
				if (p1.top+h1<p2.top-10) {
					path += " L "+l2+' '+p2.top;
					path += " C "+(pl-s)+' '+(p2.top)+ ', '+(pl-s)+' '+B1+ ', '+l1+' '+B1;
				} else if (p1.top+h1<p2.top+3) {
					path += " L "+l2+' '+p2.top;
					path += " C "+(l2-s)+' '+(p2.top+5+h2/7)+ ', '+(l1-s)+' '+(B1-5-h1/7)+ ', '+l1+' '+B1;
				}
			}
		} else {
			var	r1 = l1+w1,
				r2 = l2+w2,
				r = Math.max(r1, r2);
			path = "M "+r1+' '+p1.top;
			path += " C "+(r+S)+' '+p1.top+ ', '+(r+S)+' '+B2+ ', '+(r2)+' '+B;
			if (p1.top+h1<p2.top-10) {
				path += " L "+r2+' '+p2.top;
				path += " C "+(r+s)+' '+(p2.top)+ ', '+(r+s)+' '+B1+ ', '+r1+' '+B1;
			} else if (p1.top+h1<p2.top+3) {
				path += " L "+r2+' '+p2.top;
				path += " C "+(r+s)+' '+(p2.top+5+h2/7)+ ', '+(r+s)+' '+(B1-5-h1/7)+ ', '+r1+' '+B1;
			}
		}

		var svg = this.svg = ù('<svg', this.parent)
		.css({position:'fixed', zIndex:this.zIndex, pointerEvents:'none', width:W, height:H});
		$(svg.n).offset(ps).css({pointerEvents:'none'});
		ù('<path', svg).attr({d:path, fill:this.fill});
		if (!this.chbg) {
			var grad = svg.def('<linearGradient').stops(
				{offset:"0%", stopColor:this.fill, stopOpacity:1},
				{offset:"7%", stopColor:this.fill, stopOpacity:0.9},
				{offset:"20%", stopColor:this.fill, stopOpacity:0.2},
				{offset:"100%", stopColor:this.fill, stopOpacity:0}
			);
			if (this.side==="left") grad.attr({ x1:0, y1:0, x2:1, y2:0 });
			else grad.attr({ x1:1, y1:0, x2:0, y2:0 });
			ù('<rect', svg).attr({x:p1.left, y:p1.top, width:w1, height:h1, fill:grad});
			ù('<rect', svg).attr({x:p2.left, y:p2.top, width:w2, height:h2, fill:grad});
		}
	}

	return function(e1, e2, opts){
		return new Wzin(e1, e2, opts);
	}

})();
