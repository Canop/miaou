miaou(function(fmt){

	var	regularcoldefregex = /^\s*[:\-]*(\|[:\-]+)*\|?\s*$/,
		rowchange = {},
		nextId = 1;

	var Table = fmt.Table = function(cols){
		this.coldefstr = cols;
		this.regular = !/\+/.test(cols); // A "regular" table may accept multi-lines cells
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
		var cells = row.match(/[^|]+/g);
		if (cells) {
			this.lines.push(cells);
			this.nbcols = Math.max(this.nbcols, cells.length);
		} else {
			this.lines.push([]);
		}
	}
	// add to the table if it looks like part of it, and return true
	// doesn't add if it's not compatible, and return false
	Table.prototype.read = function(s){
		if (/^\s*$/.test(s)) return false;
		if (regularcoldefregex.test(s)) {
			if (this.regular) {
				this.multiline = true;
				this.lines.push(rowchange);
			}
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
		for (var i=0; i<cc.length; i++) {
			h += '<'+tag;
			if (i===cc.length-1 && i<this.nbcols-1) h += ' colspan='+(this.nbcols-i);
			h += '>'+cc[i]+'</'+tag+'>';
		}
		return h+'</tr>';
	}
	Table.prototype.html = function(username){
		var	h = '<div class=tablewrap>';
		h += this.style ? '<table id='+this.id+'><style scoped>'+this.style+'</style>' : '<table>';
		if (this.multiline) {
			var currentRow;
			this.lines.forEach(function(line, il){
				if (line===rowchange) {
					if (currentRow) h += this.toRow(currentRow, false);
					currentRow = null;
				} else {
					var row = line.map(function(c){ return fmt.mdStringToHtml(c.trim(), username) });
					if (!il) {
						h += this.toRow(row, true);
					} else if (currentRow) {
						for (var i=0; i<row.length; i++) {
							if (i<currentRow.length) currentRow[i] += '<br>'+ row[i];
							else currentRow[i] = row[i];
						}

					} else {
						currentRow = row;
					}
				}
			}, this);
			if (currentRow) h += this.toRow(currentRow, false);
		} else {
			h += this.lines.map(function(r, ir){
				return this.toRow(
					r.map(function(c){ return fmt.mdStringToHtml(c.trim(), username) }),
					!ir
				);
			}, this).join('');
		}
		h += '</table></div>';
		return h;
	}

	// the only purpose of the reset function is to allow unit testing
	fmt.reset = function(){
		nextId = 1;
		return fmt;
	}
});
