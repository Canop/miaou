// wzin($element1, $element2, someOpts) creates a visible link between the two elements
// Used to show the relation between an edited message and the input, or between a reply
//  icon and the replied to message.

var wzin = (function(){
	
	function Wzin(e1, e2, opts) {
		this.e1 = e1;
		this.e2 = e2;
		this.fill = opts.fill||"black";
		this.zIndex = opts.zIndex||1;
		this.bindings = [];
		if (opts.scrollables) this.bind($(opts.scrollables), 'scroll', Wzin.prototype.update);
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

		this.savedBg = [this.e1.css('background'), this.e2.css('background')];
		$().add(e1).add(e2).css({background:this.fill});

		var p1 = e1.offset(), h1 = e1.outerHeight(),
			p2 = e2.offset(), h2 = e2.outerHeight(),
			H = Math.max(p2.top+h2, p1.top+h1) - p1.top,	
			ps = {
				top: p1.top,
				left: Math.min(p1.left, p2.left)-100
			},
			W = 100+Math.abs(p1.left-p2.left);

		if (this.svg) this.svg.remove();
		var svgns = "http://www.w3.org/2000/svg";
		var svg = this.svg = document.createElementNS(svgns, "svg");
				
		var $svg = $(svg);
		$svg.css({position:'fixed', zIndex:this.zIndex, pointerEvents:'none'});
		$svg.offset(ps).width(W).height(H);

		p1.left -= ps.left; p1.top -= ps.top; 
		p2.left -= ps.left; p2.top -= ps.top;
		var path = "M "+p1.left+' '+p1.top+
			" C "+(p1.left-100)+' '+p1.top+ ', '+(p2.left-100)+' '+(p2.top+h2)+ ', '+p2.left+' '+Math.max(p2.top+h2, p1.top+h1);
		if (p1.top+h1<p2.top-10) {
			path += " L "+p2.left+' '+p2.top+" C "+(p2.left-40)+' '+(p2.top)+ ', '+(p1.left-40)+' '+(p1.top+h1)+ ', '+p1.left+' '+(p1.top+h1);
		} else if (p1.top+h1<p2.top+3) {
			path += " L "+p2.left+' '+p2.top+" C "+(p2.left-40)+' '+(p2.top+5+h2/7)+ ', '+(p1.left-40)+' '+(p1.top+h1-5-h1/7)+ ', '+p1.left+' '+(p1.top+h1);
		}
		
		var svgpath = document.createElementNS (svgns, "path");
		svgpath.setAttributeNS (null, 'd', path);
		svgpath.setAttributeNS (null, 'fill', this.fill);
		svg.appendChild (svgpath);
		
		document.body.appendChild(svg);
	}
	
	return function(e1, e2, opts){
		return new Wzin(e1,e2, opts);
	}

})();
