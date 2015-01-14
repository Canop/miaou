// wzin($element1, $element2, someOpts) creates a visible link between the two elements
// Used to show the relation between an edited message and the input, or between a reply
//  icon and the replied to message.

var wzin = (function(){

	var nextId = 0;
	
	function Wzin(e1, e2, opts) {
		this.id = nextId++;
		this.e1 = e1;
		this.e2 = e2;
		this.fill = opts.fill||"black";
		this.zIndex = opts.zIndex||1;
		this.bindings = [];
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
		var p1 = e1.offset(), h1 = e1.outerHeight(), w1 = e1.outerWidth(),
			p2 = e2.offset(), h2 = e2.outerHeight(), w2 = e2.outerWidth(),
			H = Math.max(p2.top+h2, p1.top+h1) - p1.top,	
			ps = {
				top: p1.top,
				left: Math.min(p1.left, p2.left)-100
			},
			W = 100+Math.max(w1,w2);

		p1.left -= ps.left; p1.top -= ps.top; 
		p2.left -= ps.left; p2.top -= ps.top;
		var pl = Math.min(p1.left, p2.left),
			antitwist = Math.abs(p1.left-p2.left)>p2.top-p1.top-h1;
			
		var path = "M "+p1.left+' '+p1.top;
		if (antitwist) {
			path += " H "+pl;
			path += " C "+(pl-100)+' '+p1.top+ ', '+(pl-100)+' '+(p2.top+h2)+ ', '+pl+' '+Math.max(p2.top+h2, p1.top+h1);
			path += " H "+p2.left;
			path += " V "+p2.top;
			path += " H "+pl;
			var dx = Math.min(40, p2.top-p1.top-h1+10);
			path += " C "+(pl-dx)+' '+(p2.top)+ ', '+(pl-dx)+' '+(p1.top+h1)+ ', '+p1.left+' '+(p1.top+h1);
		} else {
			path += " C "+(pl-100)+' '+p1.top+ ', '+(pl-100)+' '+(p2.top+h2)+ ', '+p2.left+' '+Math.max(p2.top+h2, p1.top+h1);
			if (p1.top+h1<p2.top-10) {
				path += " L "+p2.left+' '+p2.top;
				path += " C "+(pl-40)+' '+(p2.top)+ ', '+(pl-40)+' '+(p1.top+h1)+ ', '+p1.left+' '+(p1.top+h1);
			} else if (p1.top+h1<p2.top+3) {
				path += " L "+p2.left+' '+p2.top;
				path += " C "+(p2.left-40)+' '+(p2.top+5+h2/7)+ ', '+(p1.left-40)+' '+(p1.top+h1-5-h1/7)+ ', '+p1.left+' '+(p1.top+h1);
			}
		}
		
		var svg = this.svg = ù('<svg', this.parent).css({position:'fixed', zIndex:this.zIndex, pointerEvents:'none', width:W, height:H});
		$(svg.n).offset(ps).css({pointerEvents:'none'}); // strange bug : I can't set pointerEvents to none using ù.css :(
		ù('<path', svg).attr({d:path, fill:this.fill});
		if (!this.chbg) {
			var grad = svg.def('<linearGradient').attr({
				x1:0, y1:0, x2:1, y2:0
			}).stops(
				{offset:"0%", stopColor:this.fill, stopOpacity:1},
				{offset:"7%", stopColor:this.fill, stopOpacity:0.9},
				{offset:"20%", stopColor:this.fill, stopOpacity:0.2},
				{offset:"100%", stopColor:this.fill, stopOpacity:0}
			);
			ù('<rect', svg).attr({x:p1.left, y:p1.top, width:w1, height:h1, fill:grad});
			ù('<rect', svg).attr({x:p2.left, y:p2.top, width:w2, height:h2, fill:grad});
		}
	}
	
	return function(e1, e2, opts){
		return new Wzin(e1,e2, opts);
	}

})();
