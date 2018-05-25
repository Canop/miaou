
miaou(function(fish, md, plugins){

	var replacer = new Groumf();
	replacer.skipTags('pre', 'code');

	function render($c){
		replacer.replaceTextWithHTMLInHTMLUsingRegex(
			$c[0],
			/(^|\s|\()(-?\d+)d(\d+)([+-]\d+)?\b/ig,
			function(s, b, N, S, C){
				let mean = +N * (+S+1)/2 + (+C||0);
				return `${b}<span class=dice-roll-def data-def="${s}" bubble="Mean: ${mean}">${s}</span>`;
			}
		);
	}

	plugins.dice = {
		start: function(){
			md.registerRenderer(render, true);
			$(document.body).on("click", ".dice-roll-def", function(){
				$("#input").val("!!dice "+$(this).data("def")).focus();
				fish.closeBubbles();
			});
		}
	}

});


