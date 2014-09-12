
(function(){

	function Table(cols){
		this.style = cols.match(/[:\-]+/g).map(function(c, i){
			if (c[c.length-1]!==':') return'';
			return 'td:nth-child('+(i+1)+'){text-align:'+( c[0]===':' ? 'center' : 'right' )+'}'; 
		}).join('');
		this.rows = [];
	}
	Table.prototype.push = function(row){
		this.rows.push(row.match(/[^|]+/g));
	}
	Table.prototype.html = function(username){
		var h = '<table>'
		if (this.style) h += '<style scoped>'+this.style+'</style>';
		h += this.rows.map(function(r, ir){
			return '<tr>'+r.map(function(c){
				var tag = ir ? 'td' : 'th';
				return '<'+tag+'>'+fmtStr(c.trim(), username)+'</'+tag+'>';
			}).join('')+'</tr>';
		}).join('');
		h += '</table>';
		return h;
	}
	
	// does simple formatting of a string which may not be a complete line
	function fmtStr(s, username) {
		return s.split('`').map(function(t,i){
			if (i%2) return '<code>'+t+'</code>';
			return t
			.replace(/\[([^\]]+)\]\((https?:\/\/[^\)\s"<>,]+)\)/ig, '<a target=_blank href="$2">$1</a>') // exemple : [dystroy](http://dystroy.org)
			.replace(/\[([^\]]+)\]\((\d+)#(\d+)\)/ig, '<a target=_blank href="$2#$3">$1</a>') // exemple : [lien interne miaou](7#123456)
			.replace(/(^|[^"])((https?|ftp):\/\/[^\s"\[\]]*[^\s"\)\[\]\.,;])/ig, '$1<a target=_blank href="$2">$2</a>') // exemple : http://dystroy.org
			.replace(/(^|>)([^<]*)(<|$)/g, function(_,a,b,c){ // do replacements only on what isn't in a tag
				return a
				+ b.replace(/(^|\W)\*\*(.+?)\*\*([^\w\/]|$)/g, "$1<b>$2</b>$3")
				.replace(/(^|[^\w\/])\*([^\*]+)\*([^\w\/]|$)/g, "$1<i>$2</i>$3")
				.replace(/(^|[^\w\/])__(.+?)__([^\w\/]|$)/g, "$1<b>$2</b>$3")
				.replace(/(^|[^\w\/])_([^_]+)_([^\w\/]|$)/g, "$1<i>$2</i>$3")
				.replace(/(^|[^\w\/])---(.+?)---([^\w\/]|$)/g, "$1<strike>$2</strike>$3")
				.replace(/(^|[^.!?:;]* )(\/me)([^.!?:;]*)/g, '<span class=slashme>$1'+(username||'/me')+'$3</span>')
				+ c;
			});
		}).join('');
	}

	// converts from the message exchange format (mainly a restricted set of Markdown) to HTML
	miaou.mdToHtml = function(md, withGuiFunctions, username){
		var nums=[], table,
			lin = md.replace(/(\n\s*\n)+/g,'\n\n').replace(/^(\s*\n)+/g,'').replace(/(\s*\n\s*)+$/g,'').split('\n'),
			lout = []; // lines out
		for (var l=0; l<lin.length; l++) {
			var m, s = lin[l].replace(/</g,'&lt;').replace(/>/g,'&gt;')
				.replace(/^@\w[\w_\-\d]{2,}#(\d+)/, withGuiFunctions ? '<span class=reply to=$1>&#xe81a;</span>' : '');
			if (m=s.match(/^(?:    |\t)(.*)$/)) {
				lout.push('<code class=indent>'+m[1]+'</code>');
				continue;
			}
			if (m=s.match(/^\s*(https?:\/\/[^\s<>"]+\/[^\s<>"]+)\.(bmp|png|webp|gif|jpg|jpeg|svg)\s*$/)) {
				 // exemple : http://mustachify.me/?src=http://www.librarising.com/astrology/celebs/images2/QR/queenelizabethii.jpg
				lout.push('<img src="'+m[1]+'.'+m[2]+'">');
				continue
			}
			if (m=s.match(/^\s*(https?:\/\/[^\s<>?"]+\/[^\s<>"]+)\.(bmp|png|webp|gif|jpg|jpeg|svg)(\?[^\s<>?"]*)?\s*$/)) {
				// exemple : http://md1.libe.com/photo/566431-unnamed.jpg?height=600&modified_at=1384796271&ratio_x=03&ratio_y=02&width=900
				lout.push('<img src="'+m[1]+'.'+m[2]+(m[3]||'')+'">');
				continue;
			}
			var looksLikeARow = /\|/.test(s); 
			if (table) {
				if (looksLikeARow) {
					table.push(s);
					continue;
				} else {
					lout.push(table.html(username));
					table = null;
				}
			} else if (looksLikeARow && l<lin.length-1 && /^\s*[:\-]*(\|[:\-]*)+[:\-]*\s*$/.test(lin[l+1])) {
				table = new Table(lin[++l]);
				table.push(s);
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
})();
