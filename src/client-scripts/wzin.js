// wzin($element1, $element2, someOpts) creates a visible link between the two elements
// Used to show the relation between an edited message and the input, or between a reply
//  icon and the replied to message.

var wzin = (function(){
	
	function addsvg(tag, attrs, parent){
		var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
		if (attrs) {
			for (var key in attrs) {
				e.setAttributeNS(null, key, attrs[key]);
			}
		}		
		if (parent) parent.appendChild(e);
		return e;
	}
	
	function Wzin(e1, e2, opts) {
		this.e1 = e1;
		this.e2 = e2;
		this.fill = opts.fill||"black";
		this.zIndex = opts.zIndex||1;
		this.bindings = [];
		if (opts.scrollables) this.bind($(opts.scrollables), 'scroll', Wzin.prototype.update);
		this.parent = opts.parent || document.body;
		this.chbg = !!opts.changeElementBackground;
		this.bind($(window), 'resize', Wzin.prototype.update);
		this.update();
	}
	Wzin.prototype.bind = function(jqobj, eventtype, fun){
		fun = fun.bind(this);
		this.bindings.push([jqobj, eventtype, fun]);
		jqobj.on(eventtype, fun);
	}

	Wzin.prototype.remove = function(){
		this.svg.remove();
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
			p2 = e2.offset(), h2 = e2.outerHeight(), w2 = e1.outerWidth(),
			H = Math.max(p2.top+h2, p1.top+h1) - p1.top,	
			ps = {
				top: p1.top,
				left: Math.min(p1.left, p2.left)-100
			},
			W = 100+Math.max(w1,w2);


		p1.left -= ps.left; p1.top -= ps.top; 
		p2.left -= ps.left; p2.top -= ps.top;
		var path = "M "+p1.left+' '+p1.top+
			" C "+(p1.left-100)+' '+p1.top+ ', '+(p2.left-100)+' '+(p2.top+h2)+ ', '+p2.left+' '+Math.max(p2.top+h2, p1.top+h1);
		if (p1.top+h1<p2.top-10) {
			path += " L "+p2.left+' '+p2.top+" C "+(p2.left-40)+' '+(p2.top)+ ', '+(p1.left-40)+' '+(p1.top+h1)+ ', '+p1.left+' '+(p1.top+h1);
		} else if (p1.top+h1<p2.top+3) {
			path += " L "+p2.left+' '+p2.top+" C "+(p2.left-40)+' '+(p2.top+5+h2/7)+ ', '+(p1.left-40)+' '+(p1.top+h1-5-h1/7)+ ', '+p1.left+' '+(p1.top+h1);
		}
		
		var svg = this.svg = addsvg("svg", null, this.parent);
		var $svg = $(svg);
		$svg.css({position:'fixed', zIndex:this.zIndex, pointerEvents:'none'});
		$svg.offset(ps).width(W).height(H);
		addsvg("path", {d:path, fill:this.fill}, svg);
		
		if (!this.chbg) {
			var defs = addsvg("defs", null, svg);
			var grad = addsvg("linearGradient", {id:"wzingrad", x1:"0", y1:"0", x2:"1", y2:"0"}, defs);
			addsvg("stop", {offset:"0%", style:"stop-color:"+this.fill+";stop-opacity:1"}, grad);
			addsvg("stop", {offset:"7%", style:"stop-color:"+this.fill+";stop-opacity:0.9"}, grad);
			addsvg("stop", {offset:"20%", style:"stop-color:"+this.fill+";stop-opacity:0.2"}, grad);
			addsvg("stop", {offset:"100%", style:"stop-color:"+this.fill+";stop-opacity:0"}, grad);
			
			addsvg("rect", {x:p1.left, y:p1.top, width:w1, height:h1, fill:"url(#wzingrad)"}, svg);
			addsvg("rect", {x:p2.left, y:p2.top, width:w2, height:h2, fill:"url(#wzingrad)"}, svg);
		}
	}
	
	return function(e1, e2, opts){
		return new Wzin(e1,e2, opts);
	}

})();
