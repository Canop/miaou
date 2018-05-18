// adds a small inline colored bloc after strings like #abc in rendered messages

miaou(function(md, plugins){

	var replacer = new Groumf();
	replacer.skipTags('pre', 'code');

	function render($c){
		replacer.replaceTextWithHTMLInHTMLUsingRegex(
			$c[0],
			/(^|\s|\()(#(?:[0-9a-f]{3}){1,2})\b/ig,
			function(s, start, color){
				return `${start}<div class=hashcolor style="background:${color}" bubble="${color}"></div>`;
			}
		);
	}

	plugins.hashcolor = {
		start: function(){
			md.registerRenderer(render, true);
		}
	}


});


