// Groumpf by denys.seguret@gmail.com
// https://github.com/Canop/groumf

(function(){

	"use strict";
	var WordCharRegex = /[\d@A-Z_a-z~\xa1-\xac\xae-\xaf\xb5-\xba\xc0-\xfe\u0100-\u017F]/;

	function Groumf(options){
		this.forest = {};
		this.skippedTags = {};
		this.dontCutWords = (options && options.dontCutWords!==undefined) ? options.dontCutWords : true;
		this.skipTags("audio", "img", "svg", "title", "video");
	}

	Groumf.prototype.skipTags = function(){
		for (var i=0; i<arguments.length; i++) this.skippedTags[arguments[i].toUpperCase()] = true;
	}
	Groumf.prototype.dontSkipTags = function(){
		for (var i=0; i<arguments.length; i++) this.skippedTags[arguments[i].toUpperCase()] = false;
	}

	// add an expression to search. The value is optionnal, and would be given
	// to a callback or be used as replacement value if the replacer is used without
	// callback.
	Groumf.prototype.add = function(expr,  value){
		if (expr.length<3) return console.log('Expression "'+expr+'" ignored : too short');
		var	root = expr.slice(0, 3).toLowerCase(),
			tree = this.forest[root];
		if (!tree) tree = this.forest[root] = [];
		tree.push({p:expr.toLowerCase(), v:value||expr});
		tree.sort(function(a, b){
			return b.p.length-a.p.length
		});
	}

	// searches the added expressions for a case insensitive equivalent.
	// returns the originally added expression or its value if any.
	Groumf.prototype.get = function(expr){
		var	lexpr = expr.toLowerCase(),
			tree = this.forest[lexpr.slice(0, 3)];
		if (!tree) return;
		for (var i=0; i<tree.length; i++) {
			if (tree[i].p===lexpr) return tree[i].v;
		}
	}

	Groumf.prototype.replaceInString = function(input, cb, arg3){
		if (arg3 !== undefined) return input.replace(cb, arg3);
		var	end = input.length-2,
			output = [],
			copied = 0,
			char;
		for (var p=0; p<end; p++) {
			if (this.dontCutWords && p && WordCharRegex.test(input[p-1])) continue;
			var	root = input.slice(p, p+3).toLowerCase(),
				tree = this.forest[root];
			if (!tree) continue;
			for (var i=0; i<tree.length; i++) {
				var pat = tree[i].p;
				if (this.dontCutWords && (char=input[p+pat.length]) && WordCharRegex.test(char)) continue;
				var cur = input.slice(p, p+pat.length);
				if (cur.toLowerCase()===pat) {
					var r = cb ? cb(cur, tree[i].v) : tree[i].v;
					if (p) output.push(input.slice(copied, p));
					output.push(r);
					p += pat.length;
					copied = p;
					break;
				}
			}
		}
		output.push(input.slice(copied, input.length));
		return output.join('');
	}

	Groumf.prototype.replaceTextWithTextInHTML = function(element, cb, arg3){
		var nodes = element.childNodes;
		for (var i=nodes.length; i--;) {
			var node = nodes[i];
			if (node.nodeType===3) {
				node.nodeValue = this.replaceInString(node.nodeValue, cb, arg3);
			} else if (!this.skippedTags[node.tagName]) {
				this.replaceTextWithTextInHTML(node, cb, arg3);
			}
		}
		return element;
	}

	// return true if the element was modified
	Groumf.prototype._replaceTextWithHTMLInHTMLUsingRegex = function(element, regex, cb){
		var nodes = [].slice.call(element.childNodes);
		var changed = false;
		for (var i=0; i<nodes.length; i++) {
			var node = nodes[i];
			if (node.nodeType===3) {
				var	input = node.nodeValue,
					copied = 0,
					res;
				while (res = regex.exec(input)) {
					changed = true;
					if (res.index) {
						element.insertBefore(document.createTextNode(input.slice(copied, res.index)), node);
					}
					var	r = cb.apply(null, res.concat(res.index, res.input)),
						div=document.createElement('div');
					div.innerHTML = r;
					var childNode;
					while (childNode = div.firstChild) {
						element.insertBefore(childNode, node);
					}
					copied = res.index+res[0].length;
					if (!regex.global) break;
				}
				if (copied) {
					element.insertBefore(document.createTextNode(input.slice(copied, input.length)), node);
					element.removeChild(node);
				}
			} else {
				if (!this.skippedTags[node.tagName]) {
					if (this._replaceTextWithHTMLInHTMLUsingRegex(node, regex, cb)) {
						changed = true;
					}
				}
			}
		}
		return changed;
	}

	// return true if the element was modified
	Groumf.prototype.replaceTextWithHTMLInHTMLUsingRegex = function(element, regex, cb){
		var changed = this._replaceTextWithHTMLInHTMLUsingRegex(element, regex, cb);
		if (changed) element.normalize();
		return element;
	}

	Groumf.prototype._replaceTextWithHTMLInHTML = function(element, cb){
		var	nodes = [].slice.call(element.childNodes),
			changed = false;
		for (var i=0; i<nodes.length; i++) {
			var node = nodes[i];
			if (node.nodeType===3) {
				var	input = node.nodeValue,
					end = input.length-2,
					copied = 0,
					char;
				for (var p=0; p<end; p++) {
					if (this.dontCutWords && p && WordCharRegex.test(input[p-1])) continue;
					var	root = input.slice(p, p+3).toLowerCase(),
						tree = this.forest[root];
					if (!tree) continue;
					for (var j=0; j<tree.length; j++) {
						var pat = tree[j].p;
						if (this.dontCutWords && (char=input[p+pat.length]) && WordCharRegex.test(char)) continue;
						var cur = input.slice(p, p+pat.length);
						if (cur.toLowerCase()===pat) {
							changed = true;
							if (p) element.insertBefore(document.createTextNode(input.slice(copied, p)), node);
							var	r = cb ? cb(cur, tree[j].v) : tree[j].v,
								div=document.createElement('div');
							div.innerHTML = r;
							for (var k=0, newNodes=div.childNodes, nnl=newNodes.length; k<nnl; k++) {
								element.insertBefore(newNodes[k], node);
							}
							p += pat.length;
							copied = p;
							break;
						}
					}
				}
				if (copied) {
					element.insertBefore(document.createTextNode(input.slice(copied, input.length)), node);
					element.removeChild(node);
				}
			} else {
				if (!this.skippedTags[node.tagName] && this._replaceTextWithHTMLInHTML(node, cb)) {
					changed = true;
				}
			}
		}
		return changed;
	}

	Groumf.prototype.replaceTextWithHTMLInHTML = function(element, cb, arg3){
		if (arg3
			? this._replaceTextWithHTMLInHTMLUsingRegex(element, cb, arg3)
			: this._replaceTextWithHTMLInHTML(element, cb)
		) element.normalize();
		return element;
	}


	Groumf.prototype.replace = function(input, cb, arg3){
		var nodes = input.childNodes;
		if (nodes) {
			return this.replaceTextWithTextInHTML(input, cb, arg3);
		} else {
			return this.replaceInString(input, cb, arg3);
		}
	}

	;[
		'replace',
		'replaceTextWithHTMLInHTML',
		'replaceTextWithHTMLInHTMLUsingRegex',
		'replaceTextWithTextInHTML',
		'replaceInString'
	].forEach(function(n){
		Groumf[n] = function(){
			return Groumf.prototype[n].apply(new Groumf, arguments);
		};
	});

	if (typeof module !== "undefined") module.exports = Groumf;
	else if (window) window.Groumf = Groumf;

})();
