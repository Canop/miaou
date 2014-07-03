var miaou = miaou || {};

// converts from the message exchange format (mainly a restricted set of Markdown) to HTML
miaou.mdToHtml = function(md, withGuiFunctions, username){
	var nums=[];
	return md.replace(/(\n\s*\n)+/g,'\n\n').replace(/^(\s*\n)+/g,'').replace(/(\s*\n\s*)+$/g,'').split('\n').map(function(s,l){
		var m;
		s = s.replace(/</g,'&lt;').replace(/>/g,'&gt;')
			.replace(/^@\w[\w_\-\d]{2,}#(\d+)/, withGuiFunctions ? '<span class=reply to=$1>&#xe81a;</span>' : '');
		if (m=s.match(/^(?:    |\t)(.*)$/)) {
			return '<code class=indent>'+m[1]+'</code>';
		}
		if (m=s.match(/^\s*(https?:\/\/[^\s<>"]+\/[^\s<>"]+)\.(bmp|png|webp|gif|jpg|jpeg|svg)\s*$/)) {
			 // exemple : http://mustachify.me/?src=http://www.librarising.com/astrology/celebs/images2/QR/queenelizabethii.jpg
			return '<img src="'+m[1]+'.'+m[2]+'">';
		}
		if (m=s.match(/^\s*(https?:\/\/[^\s<>?"]+\/[^\s<>"]+)\.(bmp|png|webp|gif|jpg|jpeg|svg)(\?[^\s<>?"]*)?\s*$/)) {
			// exemple : http://md1.libe.com/photo/566431-unnamed.jpg?height=600&modified_at=1384796271&ratio_x=03&ratio_y=02&width=900
			return '<img src="'+m[1]+'.'+m[2]+(m[3]||'')+'">';
		}
		s = s.split('`').map(function(t,i){
			if (i%2) return '<code>'+t+'</code>';
			return t.replace(/\[([^\]]+)\]\((https?:\/\/[^\)\s"<>,]+)\)/ig, '<a target=_blank href="$2">$1</a>') // exemple : [dystroy](http://dystroy.org)
			.replace(/(^|[^"])((https?|ftp):\/\/[^\s"\[\]]*[^\s"\)\[\]\.,;])/ig, '$1<a target=_blank href="$2">$2</a>')
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
		if (m=s.match(/^(?:&gt;\s*)(.*)$/)) {
			return '<span class=citation>'+m[1]+'</span>';
		}
		if (m=s.match(/^(?:\d+\.\s+)(.*)$/)) {
			nums[l]=(nums[l-1]||0)+1;
			return '<span class=olli>'+nums[l]+'</span>'+m[1];
		}
		if (m=s.match(/^(?:\*\s+)(.*)$/))	return '<span class=ulli></span>'+m[1];
		if (m=s.match(/^(?:(#+)\s+)(.*)$/))	return '<span class=h'+m[1].length+'>'+m[2]+'</span>';
		return s;
	}).join('<br>');
}
