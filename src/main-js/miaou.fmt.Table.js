miaou(function(fmt){

	var	regularcoldefregex = /^\s*[:\-]*(\|[:\-]+)*\|?\s*$/,
		nextId = 1;

	var Table = fmt.Table = function(cols){
		this.coldefstr = cols;
		var id = this.id = 'tbl'+nextId++;
		this.multiline = false;
		this.nbcols = 0;
		if (/:/.test(cols)) {
			this.style = (cols.match(/[:\-]+/g)||[]).map(function(c){ // the ||[] might be over defensive now
				return c[c.length-1]!==':' ? 'left' : ( c[0]===':' ? 'center' : 'right' );
			}).map(function(align, i){
				return '#'+id+' td:nth-child('+(i+1)+'){text-align:'+align+'}';
			}).join('');
		}
		this.lines = [];
	}
	Table.prototype.push = function(row){
		var cells = row.replace(/(^\||\|$)/, "").split("|");
		this.lines.push(cells);
		this.nbcols = Math.max(this.nbcols, cells.length);
	}
	// add to the table if it looks like part of it, and return true
	// doesn't add if it's not compatible, and return false
	Table.prototype.read = function(s){
		if (/^\s*$/.test(s)) return false;
		if (regularcoldefregex.test(s)) {
			return true;
		}
		if (s===this.coldefstr) {
			return true;
		}
		if (/\|/.test(s)) {
			this.push(s);
			return true;
		}
		return false;
	}
	// cc : cell content array
	Table.prototype.toRow = function(cc, ishead){
		if (!cc.length) return '';
		var	h = '<tr>',
			tag = ishead ? 'th' : 'td';
		let cells = []; // [{content, colspan}]
		for (var i=0; i<cc.length; i++) {
			if (cc[i] || i==0) {
				cells.push({content:cc[i], colspan:1});
			} else {
				cells[cells.length-1].colspan++;
			}
		}
		cells[cells.length-1].colspan += this.nbcols - cc.length;
		cells.forEach(c => {
			h += '<'+tag;
			if (c.colspan>1) h += ' colspan='+c.colspan;
			h += '>'+c.content+'</'+tag+'>';
		});
		return h+'</tr>';
	}
	Table.prototype.html = function(username){
		var	h = '<div class=tablewrap>';
		h += this.style ? '<table id='+this.id+'><style scoped>'+this.style+'</style>' : '<table>';
		h += this.lines.map(function(r, ir){
			return this.toRow(
				r.map(function(c){ return fmt.mdStringToHtml(c, username) }),
				!ir
			);
		}, this).join('');
		h += '</table></div>';
		return h;
	}

	// the only purpose of the reset function is to allow unit testing
	fmt.reset = function(){
		nextId = 1;
		return fmt;
	}
});
