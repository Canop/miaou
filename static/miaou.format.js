var miaou = miaou || {};
(function(){

	// converts from the message exchange format (mainly a restricted set of Markdown) to HTML 
	miaou.mdToHtml = function(md){
		var nums=[];
		return md.replace(/(\n\s*\n)+/g,'\n\n').replace(/^(\s*\n)+/g,'').replace(/(\s*\n\s*)+$/g,'').split('\n').map(function(s,l){
			var m;
			s = s.replace(/</g,'&lt;').replace(/>/g,'&gt;');
			if (m=s.match(/^(?:    |\t)(.*)$/)) {
				return '<code class=indent>'+m[1]+'</code>';
			}
			if (m=s.match(/^\s*(https?:\/\/[^\s<>]+)\.(bmp|png|webp|gif|jpg|jpeg|svg)\s*$/)) {
				 // exemple : http://mustachify.me/?src=http://www.librarising.com/astrology/celebs/images2/QR/queenelizabethii.jpg
				return '<img src="'+m[1]+'.'+m[2]+'">';
			}
			if (m=s.match(/^\s*(https?:\/\/[^\s<>?]+)\.(bmp|png|webp|gif|jpg|jpeg|svg)(\?[^\s<>?]*)?\s*$/)) {
				// exemple : http://md1.libe.com/photo/566431-unnamed.jpg?height=600&modified_at=1384796271&ratio_x=03&ratio_y=02&width=900
				return '<img src="'+m[1]+'.'+m[2]+(m[3]||'')+'">';
			}
			s = s.split('`').map(function(t,i){
				return i%2
					? '<code>'+t+'</code>'
					: t
						.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
						.replace(/\*([^\*]+)\*/g, "<i>$1</i>")
						.replace(/__(.+?)__/g, "<b>$1</b>")
						.replace(/_([^_]+)_/g, "<i>$1</i>")
						.replace(/---(.+?)---/g, "<strike>$1</strike>")
						.replace(/\[([^\]]+)\]\((https?:\/\/[^\)\s"<>,]+)\)/ig, '<a target=_blank href="$2">$1</a>') // exemple : [dystroy](http://dystroy.org)
						.replace(/([^"])((https?|ftp):\/\/[^\s"\(\)\[\]]+)/ig, '$1<a target=_blank href="$2">$2</a>')
			}).join('');
			if (m=s.match(/^(?:&gt;\s+)(.*)$/)) {
				return '<span class=citation>'+m[1]+'</span>';
			}
			if (m=s.match(/^(?:\d+\.\s+)(.*)$/)) {
				nums[l]=(nums[l-1]||0)+1;
				return '<span class=olli>'+nums[l]+'</span>'+m[1];
			}
			if (m=s.match(/^(?:\*\s+)(.*)$/))    return '<span class=ulli></span>'+m[1];
			if (m=s.match(/^(?:#\s+)(.*)$/))     return '<span class=h1>'+m[1]+'</span>';
			if (m=s.match(/^(?:#{2,}\s+)(.*)$/)) return '<span class=h2>'+m[1]+'</span>';
			return s;
		}).join('<br>');
	}

})();
