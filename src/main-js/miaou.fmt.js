// Handles conversion from Markdown to HTML
//
// There are 3 nested levels of conversion:
// 1. mdStringToHtml : conversion of a simple string without structural elements
//                     (tables, lists, images, code blocks, etc.)
// 2. mdTextToHtml   : conversion of a text which may or not contain structural
//                     elements
// 3. mdMcToHtml     : conversion of a message content. #messages related elements
//                     like the reply mark may be added at this level
miaou(function(fmt, time){
	// format of the line, between the header and the body of a table,
	//  defining the column alignements.
	// This is how we recognize a table in Markdown
	var	coldefregex = /^\s*[:\-]*([\|\+][:\-]+)+(\||\+)?\s*$/,
		coderegex = /^( {4}|\t)/,
		braceSpanClassWhitelist = (new Set).add("tag"), // tokens allowed as class in [class:something]
		pragmasWhitelist = (new Set).add("lang");

	fmt.whiteListBraceSpanClass = function(clas){
		braceSpanClassWhitelist.add(clas);
	}

	fmt.whiteListPragma = function(pragma){
		pragmasWhitelist.add(pragma);
	}

	fmt.mdStringToHtml = function(s, username){
		return s.split('`').map(function(t, i){
			if (i%2) return '<code>'+t+'</code>';
			return t
			.replace(/\[([\w-]{3,50}):([A-Za-zÀ-ÿ0-9\s\/_-]{2,50})\]/g, function(s, clas, con){
				 // examples: [tag:Mounty-Hall]  [bronze-badge:Miaou/Less Faceless]
				if (!braceSpanClassWhitelist.has(clas)) return s;
				return '<span class='+clas+'>'+con+'</span>';
			})
			// Matching URLs in text is tricky: the syntax is fundamentally ambiguous and
			// we try to detect what looks like an URl and not the text around.
			// See cases in /tests/format/format-links.tests.js
			.replace( // example : [dystroy](http://dystroy.org)
				// /\[([^\]<>]+)\]\((https?:\/\/[^\)\s"<>]+)\)/ig,

				/\[([^\]<>]+)\]\((https?:\/\/[^()\s"<>]+(?:\([^()\s"<>]*\)[^()\s"<>]*)*)\)/ig,

				'<a target=_blank href="$2">$1</a>'
			)
			.replace(/\[([^\]]+)\]\((\d+)?(\?\w*)?#(\d*)\)/g, function(s, t, r, _, m){
				// examples : [a message](7#123456), [a room](7#)
				r = r || (miaou.locals && miaou.locals.room.id);
				if (!r) return s;
				return '<a target=_blank href='+r+'#'+m+'>'+t+'</a>';
			})
			.replace(/\[([^\]]+)\]\(u\/([\w-]+)\)/g, function(s, t, u){
				// example : [some user](u/1234)
				return '<a target=_blank href=user/'+u+'>'+t+'</a>';
			})
			/* eslint-disable max-len */
			.replace(
				// example : https://dystroy.org
				// most of the complexity here is related to accepting
				// - balanced (not nested) parenthesis
				// - punctuation, but not as last character
				// while minimizing the risk of catastrophic backtracking

				/(^|[^"<>])((?:https?|ftp):\/\/(?:(?:[^\s"[\]()]*\([^\s"[\]()]*\))*(?:[^\s"[\]()]+[^\s"()[\],.:])?))(?=$|[\s(),.:[\]])/gi,

				'$1<a target=_blank href="$2">$2</a>'
			)
			/* eslint-enable max-len */
			.replace(/\[[ .]\]/g, "☐")
			.replace(/\[x]/ig, "☑")
			.replace(/(^|>)([^<]*)(<|$)/g, function(_, a, b, c){
				// do replacements only on what isn't in a tag
				return a
				+ b
				.replace(/(^|[^\w\/-])(@[a-zA-Z][\w\-]{2,19})\b/g, function(_, sp, ping){ // ping
					var isme = miaou.locals && miaou.locals.me && miaou.locals.me.name===ping.slice(1);
					return sp+'<span class="ping'+(isme?' ping-me':'')+'">'+ping+'</span>';
				})
				.replace(/(^|\W)\*\*(.+?)\*\*(?=[^\w\/]|$)/g, "$1<b>$2</b>")
				.replace(/(^|[^\w\/])\*([^\*]+)\*(?=[^\w\/\*]|$)/g, "$1<i>$2</i>")
				.replace(/(^|[^\w\/])__(.+?)__(?=[^\w\/]|$)/g, "$1<u>$2</u>")
				.replace(/(^|[^\w\/])_([^_]+)_(?=[^\w\/]|$)/g, "$1<i>$2</i>")
				.replace(/(^|[^\w\/])---(.+?)---(?=[^\w\/]|$)/g, "$1<strike>$2</strike>")
				+ c;
			})
			.replace(/---[^<>]*?(<(\w{1,6})\b[^<>\-]*>[^<>\-]*<\/\2>[^<>\-]*)*---/g, function(s){
				return s.length>6 ? '<strike>'+s.slice(3, -3)+'</strike>' : s;
			})
			.replace(/\*\*[^<>]*?(<(\w{1,6})\b[^<>]*>[^<>]*<\/\2>[^<>]*)*\*\*/g, function(s){
				return s.length>4 ? '<b>'+s.slice(2, -2)+'</b>' : s;
			})
			.replace(/\*[^<>\*]*?(<(\w{1,6})\b[^<>]*>[^<>]*<\/\2>[^<>]*)*\*(?=[^\*]|$)/g, function(s){
				return s.length>2 ? '<i>'+s.slice(1, -1)+'</i>' : s;
			})
			.replace(/\^([^ ^~><]+)\^/g, function(_, s){
				return '<sup>'+s+'</sup>';
			})
			.replace(/~([^ ^~><]+)~/g, function(_, s){
				return '<sub>'+s+'</sub>';
			})
			.replace(/#date\((\d{10})(?:,([^)]+))?\)/g, function(_, t, format){
				return time.formatDate(+t*1000, format);
			})
		}).join('')
		.replace(/^\/me(.*)$/ig, '<span class=slashme>'+(username||'/me')+'$1</span>')
	}

	function wrapCode(code, lang){
		var s = '<pre class="prettyprint';
		if (lang) s += " lang-"+lang;
		s += '">';
		s += code.join('\n');
		s += '</pre>';
		return s;
	}

	function _mdTextToHtml(md, username, noThumb){
		var	table,
			lang, // current code language, set with a #lang-* pragma
			ul, ol, code, citation, // arrays : their elements make multi lines structures
			lin = md.replace(/(\n\s*\n)+/g, '\n\n').replace(/^(\s*\n)+/g, '').replace(/(\s*\n\s*)+$/g, '').split('\n'),
			lout = []; // lines out
		for (var l=0; l<lin.length; l++) {
			var m, s = lin[l].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

			var pragmaMatch = s.match(/^#(\w+)(-\w+)*(\([^\)]*\))?\s*$/);
			if (pragmaMatch) {
				// examples of pragmas:
				// #lang-sql
				// #graph(compare,sum)
				// the name is the part before the dash (if any)
				var name = pragmaMatch[1];
				if (pragmasWhitelist.has(name)) {
					lout.push('<i class="pragma pragma-'+name+'">'+s+'</i>');
					if (name==="lang" && pragmaMatch[2]) {
						lang = pragmaMatch[2].slice(1);
					}
					continue;
				}
			}

			var codeline = ((/^\s*$/.test(s) && code) || coderegex.test(s)) && !(table && /\|/.test(s));
			if (code) {
				if (codeline) {
					code.push(s.replace(coderegex, ''));
					continue;
				} else {
					lout.push(wrapCode(code, lang));
					code = null;
				}
			} else if (codeline) {
				// we check we're not in fact at the start of a table
				// ("    A    |     B    \n-----+----\n    a    |    b")
				if (
					l<lin.length-2 && /\|/.test(s)
					&& coldefregex.test(lin[l+1])
					&& !coderegex.test(lin[l+1])
					&& /\|/.test(lin[l+2])
				) {
					table = new fmt.Table(lin[++l]);
					table.push(s);
					table.push(lin[++l]);
				} else {
					code = [s.replace(coderegex, '')];
				}
				continue;
			}

			if ((m=s.match(/^\s*(https?:\/\/)?(\w\.imgur\.com\/)(\w{3,10})\.(gifv?|png|jpg)\s*$/i))) {
				var bu = (m[1]||"https://")+m[2]+m[3];
				if (!noThumb && bu[bu.length-1]!=='m') {
					// use thumbnail for imgur images whenever possible
					if (m[4]==='gifv') {
						lout.push('<img href='+bu+'.'+m[4]+' src='+bu+'m.'+m[4].slice(0, -1)+'>');
					} else {
						lout.push('<img href='+bu+'.'+m[4]+' src='+bu+'m.'+m[4]+'>');
					}
				} else {
					lout.push('<img src='+bu+'.'+m[4]+'>');
				}
				continue;
			}
			var regex = /^\s*(https?:\/\/[^\s<>"]+\/[^\s<>"]+)\.(bmp|png|webp|gif|jpg|jpeg|svg)\s*$/i;
			if ((m=s.match(regex))) {
				// example : http://mustachify.me/?src=http://blabla/queenelizabethii.jpg
				lout.push('<img src="'+m[1]+'.'+m[2]+'">');
				continue;
			}
			regex = /^\s*(https?:\/\/[^\s<>?"]+\/[^\s<>"]+)\.(bmp|png|webp|gif|jpg|jpeg|svg)(\?[^\s<>?"]*)?\s*$/i;
			if ((m=s.match(regex))) {
				// example : http://md1.libe.com/photo/566431-unnamed.jpg?height=600&ratio_x=03&ratio_y=02&width=900
				lout.push('<img src="'+m[1]+'.'+m[2]+(m[3]||'')+'">');
				continue;
			}

			if (table) {
				if (table.read(s)) continue;
				lout.push(table.html(username));
				table = null;
			} else if (/\|/.test(s) || /^\+\-[\-\+]*\+$/.test(s)) {
				if (coldefregex.test(s)) {
					table = new fmt.Table(s);
					table.push('');
					continue;
				} else if (l<lin.length-1 && coldefregex.test(lin[l+1])) {
					table = new fmt.Table(lin[++l]);
					table.push(s);
					continue;
				}
			}

			if (/^--\s*$/.test(lin[l])) {
				lout.push('<hr>');
				continue;
			}

			let timeBefore = Date.now();
			s_t = fmt.mdStringToHtml(s, username, noThumb);
			let duration = Date.now() - timeBefore;
			if (duration>2) {
				// to detect catastrophic backtracking
				console.log("Slow mdStringToHtml. Duration=", duration, "text:", s);
			}
			s = s_t;

			m=s.match(/^(?:&gt;\s*)(.*)$/);
			if (citation) {
				if (m) {
					citation.push(m[1]);
					continue;
				} else {
					lout.push('<div class=citation>' + citation.join('<br>') + '</div>');
					citation = null;
				}
			} else if (m) {
				citation = [m[1]];
				continue;
			}

			m=s.match(/^(?:\d{1,3}\.\s+)(.*)$/);
			if (ol) {
				if (m) {
					ol.push(m[1]);
					continue;
				} else {
					lout.push('<ol>'+ol.map(function(i){ return '<li>'+i+'</li>' }).join('')+'</ol>');
					ol = null;
				}
			} else if (m) {
				ol = [m[1]]
				continue;
			}

			m=s.match(/^(?:\*\s+)(.*)$/);
			if (ul) {
				if (m) {
					ul.push(m[1]);
					continue;
				} else {
					lout.push('<ul>'+ul.map(function(i){ return '<li>'+i+'</li>' }).join('')+'</ul>');
					ul = null;
				}
			} else if (m) {
				ul = [m[1]]
				continue;
			}

			if ((m=s.match(/^(?:(#+)\s+)(.*)$/)))	{
				lout.push('<span class=h'+m[1].length+'>'+m[2]+'</span>');
				continue;
			}
			lout.push(s);
		}
		if (table) lout.push(table.html(username));
		if (code) lout.push(wrapCode(code, lang));
		if (citation) lout.push('<div class=citation>' + citation.join('<br>') + '</div>');
		if (ol) lout.push('<ol>'+ol.map(function(i){ return '<li>'+i+'</li>' }).join('')+'</ol>');
		if (ul) lout.push('<ul>'+ul.map(function(i){ return '<li>'+i+'</li>' }).join('')+'</ul>');
		return lout.join('<br>');
	}

	fmt.mdTextToHtml = function(md, username, noThumb){
		return _mdTextToHtml(md.replace(/^@\w[\w\-]{2,}#\d+/, ''), username, noThumb);
	}

	fmt.mdMcToHtml = function(md, username){
		return md.replace(/^(?:@(\w[\w\-]{2,})#(\d+)\s?)?([\s\S]*)/, function(_, name, num, text){
			var html = _mdTextToHtml(text, username);
			if (num) {
				html = '<span class=reply rn="'+name+'" to='+num+'>'
				+ '&#xe82c;' // fontello icon-up-small
				+ '</span>'
				+ html;
			}
			return html;
		});
	}

});
