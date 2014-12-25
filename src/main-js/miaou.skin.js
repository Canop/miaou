
miaou(function(skin){

	// finds the value of the background for the rule(s) matching the
	//  passed regex.
	// If there's a captured group in the regex, an array is returned (the submatch
	//  is used as a number for sorting the elements)
	function getCssBackground(regex){
		var matches = [];
		for (var is=0; is<document.styleSheets.length; is++) {
			var sheet = document.styleSheets[is];
			var rules = sheet.rules || sheet.cssRules;
			for (var ir=rules.length; ir-->0;) {
				var	rule = rules[ir];
				if (!rule.selectorText) continue;
				var match = rule.selectorText.match(regex);
				if (!match) continue;
				var bg = rule.style.getPropertyValue("background-color");
				if (match.length===1) return bg;
				matches.push({ num:+match[1], bg:bg });
			}
		}
		return matches
		.sort(function(a,b){ return a.num-b.num })
		.map(function(a){ return a.bg });
	}


	skin.wzincolors = {
		conv:  getCssBackground(/^\.wzin-conv-(\d+)$/),
		edit:  getCssBackground(/^\.wzin-edit$/),
		reply: getCssBackground(/^\.wzin-reply$/)
	}

});
