// A simple SVG library
//  website : http://Github.com/Canop/hu.js
//  author  : denys.seguret@gmail.com
;(function(){
	"use strict";
	
	var nextnum = 1,
		U = function(n) { this.n = n },
		fn = U.prototype,
		nopx = { // css properties which don't need a unit
			"columnCount": 1,
			"fillOpacity": 1,
			"flexGrow": 1,
			"flexShrink": 1,
			"fontWeight": 1,
			"opacity": 1,
			"zIndex": 1
		};

	function node(a, c){
		if (a instanceof U) return a.n;
		if (c) c = node(c);
		if (typeof a === "string") {
			var m = a.match(/^\s*<\s*(\w+)\s*>?\s*$/);
			if (m) {
				var n = document.createElementNS("http://www.w3.org/2000/svg", m[1]);
				if (/^svg$/i.test(n.tagName)) {
					// this as a hack to force Firefox to see the dimension of the element
					ù('<rect', n).attr({width:"100%", height:"100%", opacity:0});
				}
				return n;
			}
			return (c||document).querySelector(a);
		}
		return a[0]||a; // to support jQuery elements and nodelists
	}	

	window.ù = window.hu = function(a, c){
		if (!c) return new U(node(a));
		c = node(c);
		a = node(a, c);
		if (!a) return null;
		if (c && !a.parentNode) c.appendChild(a);
		return new U(a);
	}

	// reverse camel case : "strokeOpacity" -> "stroke-opacity"
	function rcc(n){
		return n.replace(/[A-Z]/g, function(l){ return '-'+l.toLowerCase() });
	}

	fn.append = function(a){
		this.n.appendChild(node(a));
		return this;
	}
	fn.prependTo = function(a){
		a = node(a);
		a.insertBefore(this.n, a.firstChild);
		return this;
	}

	fn.empty = function(){
		for (var l=this.n.childNodes, i=l.length; i--;) {
			if (!/^defs$/i.test(l[i].tagName)) l[i].remove();
		}
		return this;
	}

	fn.autoid = function(){
		return this.attrnv('id', 'ù'+nextnum++);
	}
	
	fn.text = function(s){
		this.empty().n.appendChild(document.createTextNode(s));
		return this;
	}
	
	fn.def = function(a){
		var u = ù(a), p = this;
		while (p) {
			if (p.n.tagName==="svg") {
				var defs = ù("defs", p);
				if (!defs) defs = ù('<defs', p.n);
				defs.n.appendChild(u.n); 
				return u.autoid();
			}
			p = ù(p.parentNode);
		}
		throw "Node not added to a SVG element";
	}

	fn.stops = function(){
		for (var i=0; i<arguments.length; i++) {
			ù('<stop', this).attr(arguments[i]);
		}
		return this;
	}

	fn.rgrad = function(cx, cy, r, c1, c2){
		return this.def('<radialGradient').attr({cx:cx, cy:cy, r:r}).stops(
			{offset:'0%', stopColor:c1},
			{offset:'100%', stopColor:c2}
		);
	}
	
	fn.width = function(v){
		// window.getComputedStyle is the only thing that seems to work on FF when there are nested svg elements
		if (v === undefined) return this.n.getBBox().width || parseInt(window.getComputedStyle(this.n).width); 
		return this.attrnv('width', v);
	}
	fn.height = function(v){
		if (v === undefined) return this.n.getBBox().height || parseInt(window.getComputedStyle(this.n).height);
		return this.attrnv('height', v);
	}
	
	// css name value
	fn.cssnv = function(name, value){
		name = rcc(name);
		if (value===undefined) return this.n.style[name];
		if (typeof value === "number" && !nopx[name]) value += 'px';
		this.n.style[name] = value;
		return this;
	}
	
	fn.css = function(a1, a2){
		if (typeof a1 === "string") return this.cssnv(a1, a2);
		for (var k in a1) {
			this.cssnv(k, a1[k]);
		}
		return this;
	}
	
	// attr name value
	fn.attrnv = function(name, value){
		name = rcc(name);
		if (value===undefined) return this.n.getAttributeNS(null, name);
		if (value instanceof U) value = "url(#"+value.attrnv('id')+")";
		this.n.setAttributeNS(null, name, value);
		return this;
	}
	
	fn.attr = function(a1, a2){
		if (typeof a1 === "string") return this.attrnv(a1, a2);
		for (var k in a1) {
			this.attrnv(k, a1[k]);
		}
		return this;		
	}

	fn.on = function(et, f){
		et.split(' ').forEach(function(et){
			this.addEventListener(et, f);
		}, this.n);
		return this;
	}
	fn.off = function(et, f){
		et.split(' ').forEach(function(et){
			this.removeEventListener(et, f);
		}, this.n);
		return this;
	}
	fn.remove = function(){
		this.n.remove();
		return this;
	}
	
	fn.animate = function(dst, duration, cb){
		var u = this, vars = [];
		for (var k in dst){
			var dstk = dst[k];
			k = rcc(k);
			var v = {key:k, dst:dstk},
				sk = this.n.style[k];
			if (sk!==undefined && sk!=="") {
				v.f = fn.css;
				v.start = parseFloat(sk);
			} else {
				v.f = fn.attr;
				var d = this.n[k] || this.attr(k);
				if (d) {
					v.start = parseFloat(d.baseVal ? d.baseVal.value : d); // you have a baseval for example in SVGAnimatedLength
				} else {
					v.start = 0;
				}
			}
			vars.push(v);
		}
		var start = Date.now(), end = start+duration;
		(function step(){
			var now = Date.now()
			vars.forEach(function(v){
				v.f.call(u, v.key, v.start+(now-start)*(v.dst-v.start)/duration);
			});
			if (now<end) return setTimeout(step, 10);
			vars.forEach(function(v){
				v.f.call(u, v.key, v.dst);
			});
			if (cb) cb.call(u);
		})();
		return this;
	}
	
	for (var n in fn) {
		if (typeof fn[n] === "function") ù[n] = fn[n];
	}

})();
