// generic textarea functions

// replace the selected part by rep, or what is returned by rep if it's a function
$.fn.replaceSelection = function(rep){
	return this.each(function(){		
		var v = this.value, s = this.selectionStart, e = this.selectionEnd;
		var toReplace = v.slice(s,e),
			replacement = typeof rep === "function" ? rep.call(this, toReplace, v, s, e) : rep;
		this.value = v.slice(0, s) + replacement + v.slice(e);
		this.selectionEnd = e + replacement.length - toReplace.length;
		this.selectionStart = e-s ? s : this.selectionEnd;
		this.focus();
	})
}

// returns the currently selected text
$.fn.selectedText = function(){
	var input = this.get(0);
	return input.value.slice(input.selectionStart, input.selectionEnd);
}

// changes the selection so that it covers entire line(s)
$.fn.selectLines = function(){
	return this.each(function(i,s){
		if (this.selectionStart>0 && this.value[this.selectionStart-1]!=='\n') {
			s = this.value.lastIndexOf('\n', this.selectionStart-1);
			this.selectionStart = Math.max(0, s+1);
		}
		if (this.selectionStart===this.selectionEnd) this.selectionEnd++;
		if (this.selectionEnd<this.value.length) {
			if (this.value[this.selectionEnd-1]==='\n') {
				if (this.selectionEnd>this.selectionStart) this.selectionEnd--;
			} else {
				s = this.value.indexOf('\n', this.selectionEnd-1);
				this.selectionEnd = s===-1 ? this.value.length : s;				
			}
		}
		this.focus();
	})
}

// insert some string at the end of current selection and ensures it's a whole line
$.fn.insertLine = function(s){
	return this.each(function(){
		var e = this.selectionEnd, v = this.value;
		if (e>0 && v[e-1]!='\n') s = '\n'+s;
		if (e<v.length && v[e]!='\n') s += '\n';
		this.value = v.slice(0,e)+s+v.slice(e);
		this.selectionStart += s.length;
		this.selectionEnd = this.selectionStart;
		this.focus();
	});
}

// replaces what matches the regex, keeping the selection, not doing anything if there's no match
// The second argument can be a string or a function
$.fn.replaceInVal = function(r, rep){
	this.each(function(){
		var nbm = 0, s = this.selectionStart, e = this.selectionEnd;
		var v = this.value.replace(r, function(m){
			var n = typeof rep === "function" ? rep(m) : (rep||''),
				d = n.length - m.length, offset = arguments[arguments.length-2];
			if (s > offset)	s += d;
			if (e > offset)	e += d;
			nbm++;
			return n;
		});
		if (!nbm) return;
		this.value = v;
		this.selectionStart = s;
		this.selectionEnd = e;
	});
}
