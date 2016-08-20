// adds a small inline colored bloc after strings like #abc in rendered messages

miaou(function(md, plugins){

	function render($c){
		Groumf.replaceTextWithHTMLInHTMLUsingRegex(
			$c[0],
			/(?:^|\s|\()#([0-9a-f]{3}|[0-9a-f]{6})\b/ig,
			function(s, color){
				return s+'<div class=hashcolor style="background:#'+color+'"/>';
			}
		);
	}
	
	plugins.hashcolor = {
		start: function(){
			md.registerRenderer(render, true);
		}
	}

});


