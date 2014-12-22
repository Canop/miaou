(function(){
	
	var	coldefregex = /^\s*[:\-]*([\|\+][:\-]+)+(\||\+)?\s*$/,
		regularcoldefregex = /^\s*[:\-]*(\|[:\-]+)*\|?\s*$/,
		rowchange = {},
		nextId = 1;

	function Table(cols){
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
					var row = line.map(function(c){ return fmtStr(c.trim(), username) });
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
					r.map(function(c){ return fmtStr(c.trim(), username) }),
					!ir
				);
			}, this).join('');			
		}
		h += '</table></div>';
		return h;
	}
	
	// does simple formatting of a string which may not be a complete line
	function fmtStr(s, username) {
		return s.split('`').map(function(t,i){
			if (i%2) return '<code>'+t+'</code>';
			return t
			.replace(/\[([^\]]+)\]\((https?:\/\/[^\)\s"<>]+)\)/ig, '<a target=_blank href="$2">$1</a>') // exemple : [dystroy](http://dystroy.org)
			.replace(/\[([^\]]+)\]\((\d+)?(\?\w*)?#(\d+)\)/g, function(s,t,r,_,m){ // exemple : [lien interne miaou](7#123456)
				if (!(r||room)) return s;
				return '<a target=_blank href='+(r||room.id)+'#'+m+'>'+t+'</a>';
			})
			// fixme : the following replacement should not happen inside a link ( exemple :  [http://some.url](http://some.url) )
			.replace(/(^|[^"])((https?|ftp):\/\/[^\s"\[\]]*[^\s"\)\[\]\.,;])/ig, '$1<a target=_blank href="$2">$2</a>') // exemple : http://dystroy.org
			.replace(/(^|>)([^<]*)(<|$)/g, function(_,a,b,c){ // do replacements only on what isn't in a tag
				return a
				+ b.replace(/(^|\W)\*\*(.+?)\*\*(?=[^\w\/]|$)/g, "$1<b>$2</b>")
				.replace(/(^|[^\w\/])\*([^\*]+)\*(?=[^\w\/\*]|$)/g, "$1<i>$2</i>")
				.replace(/(^|[^\w\/])__(.+?)__(?=[^\w\/]|$)/g, "$1<b>$2</b>")
				.replace(/(^|[^\w\/])_([^_]+)_(?=[^\w\/]|$)/g, "$1<i>$2</i>")
				.replace(/(^|[^\w\/])---(.+?)---(?=[^\w\/]|$)/g, "$1<strike>$2</strike>")
				+ c;
			})
			// the following 3 replacements are only here for very specific cases, I'm not sure they're worth the cost
			.replace(/---[^<>]*?(<(\w{1,6})\b[^<>\-]*>[^<>\-]*<\/\2>[^<>\-]*)*---/g, function(s){ return s.length>6 ? '<strike>'+s.slice(3,-3)+'</strike>' : s })
			.replace(/\*\*[^<>]*?(<(\w{1,6})\b[^<>\-]*>[^<>\-]*<\/\2>[^<>\-]*)*\*\*/g, function(s){ return s.length>4 ? '<b>'+s.slice(2,-2)+'</b>' : s })
			.replace(/\*[^<>\*]*?(<(\w{1,6})\b[^<>\-]*>[^<>\-]*<\/\2>[^<>\-]*)*\*(?=[^\*]|$)/g, function(s){ return s.length>2 ? '<i>'+s.slice(1,-1)+'</i>' : s })
		}).join('')
		.replace(/^\/me(.*)$/g, '<span class=slashme>'+(username||'/me')+'$1</span>')
	}

	// converts from the message exchange format (mainly a restricted set of Markdown) to HTML
	miaou.mdToHtml = function(md, withGuiFunctions, username){
		var nums=[], table,
			lin = md
			.replace(/^(--(?!-)|\+\+)/,'') // should only happen when previewing messages
			.replace(/(\n\s*\n)+/g,'\n\n').replace(/^(\s*\n)+/g,'').replace(/(\s*\n\s*)+$/g,'').split('\n'),
			lout = []; // lines out
		for (var l=0; l<lin.length; l++) {
			var m, s = lin[l].replace(/</g,'&lt;').replace(/>/g,'&gt;')
				.replace(/^@\w[\w\-]{2,}#(\d+)/, withGuiFunctions ? '<span class=reply to=$1>&#xe81a;</span>' : '');
			if ( (m=s.match(/^(?:    |\t)(.*)$/)) && !(table && /\|/.test(s)) ) {
				lout.push('<code class=indent>'+m[1]+'</code>');
				continue;
			}
			if (m=s.match(/^\s*(https?:\/\/)?(\w\.imgur\.com\/)(\w{3,10})\.(gif|png|jpg)\s*$/)) {
				var bu = (m[1]||"https://")+m[2]+m[3];
				if (bu[bu.length-1]!=='m') {
					// use thumbnail for imgur images whenever possible
					lout.push('<img href='+bu+'.'+m[4]+' src='+bu+'m.'+m[4]+'>');
				} else {
					lout.push('<img src='+bu+'.'+m[4]+'>');
				}
				continue;
			}
			if (m=s.match(/^\s*(https?:\/\/[^\s<>"]+\/[^\s<>"]+)\.(bmp|png|webp|gif|jpg|jpeg|svg)\s*$/)) {
				 // exemple : http://mustachify.me/?src=http://www.librarising.com/astrology/celebs/images2/QR/queenelizabethii.jpg
				lout.push('<img src="'+m[1]+'.'+m[2]+'">');
				continue;
			}
			if (m=s.match(/^\s*(https?:\/\/[^\s<>?"]+\/[^\s<>"]+)\.(bmp|png|webp|gif|jpg|jpeg|svg)(\?[^\s<>?"]*)?\s*$/)) {
				// exemple : http://md1.libe.com/photo/566431-unnamed.jpg?height=600&modified_at=1384796271&ratio_x=03&ratio_y=02&width=900
				lout.push('<img src="'+m[1]+'.'+m[2]+(m[3]||'')+'">');
				continue;
			}
			if (table) {
				if (table.read(s)) continue;
				lout.push(table.html(username));
				table = null;
			} else if (/\|/.test(s) || /^\+\-[\-\+]*\+$/.test(s)) {
				if (coldefregex.test(s)) {
					table = new Table(s);
					table.push('');
					continue;
				} else if (l<lin.length-1 && coldefregex.test(lin[l+1])) {
					table = new Table(lin[++l]);
					table.push(s);
					continue;
				}
			}
			if (/^--\s*$/.test(lin[l])) {
				lout.push('<hr>');
				continue;
			}
			s = fmtStr(s, username);
			if (m=s.match(/^(?:&gt;\s*)(.*)$/)) {
				lout.push('<span class=citation>'+m[1]+'</span>');
				continue;
			}
			if (m=s.match(/^(?:\d+\.\s+)(.*)$/)) {
				nums[l]=(nums[l-1]||0)+1;
				lout.push('<span class=olli>'+nums[l]+'</span>'+m[1]);
				continue;
			}
			if (m=s.match(/^(?:\*\s+)(.*)$/)) {
				lout.push('<span class=ulli></span>'+m[1]);
				continue;
			}
			if (m=s.match(/^(?:(#+)\s+)(.*)$/))	{
				lout.push('<span class=h'+m[1].length+'>'+m[2]+'</span>');
				continue;
			}
			lout.push(s);
		}
		if (table) lout.push(table.html(username));
		return lout.join('<br>');
	}
	
	// the only purpose of the reset function is to allow unit testing
	miaou.mdToHtml.reset = function(){
		nextId = 1;
		return miaou.mdToHtml;
	}
	
})();
