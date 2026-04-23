
(function fetchTheme(){
	if ($("#theme-link").length) return; // css already imported (for example in pad.mob.pug)
	// Defined by the server, locals.theme takes into account whether the browser is mobile,
	//  the default server themes (mobile and desktop), and the global user pref.
	//  It doesn't take into account the localStorage pref, hence the computation here.
	let theme = miaou.locals.theme;
	if (miaou.locals.prefDefinitions) {
		let def = miaou.locals.prefDefinitions.find(def=>def.key==="theme");
		let me = miaou.locals.me;
		let themes = def.values.map(v=>v.value);
		if (me) {
			let localThemePref = localStorage.getItem("miaou." + me.id + ".prefs.theme");
			if (themes.includes(localThemePref)) {
				theme = localThemePref;
			}
		}
		let urlThemeMatch = document.location.toString().match(/[?&]theme=([\w-]+)(&|$)/);
		if (urlThemeMatch && themes.includes(urlThemeMatch[1])) {
			theme = urlThemeMatch[1];
		}
		if (theme==="default") {
			theme = themes[1]; // themes[0] is "default"
		}
	}
	// document.write avoids a delay in css application (with the downside that js execution waits for the
	//  theme to be downloaded)
	document.write(`<link rel=stylesheet href="${miaou.root}static/themes/${theme}/miaou.css?v=12">`);
})();

miaou(function(skin){

	// finds the value of the property for the rule(s) matching the
	//  passed regex.
	// If there's a captured group in the regex, an array is returned (the submatch
	//  is used as a number for sorting the elements)
	skin.getCssValue = function(regex, property){
		let matches = [];
		for (let is=0; is<document.styleSheets.length; is++) {
			let sheet = document.styleSheets[is];
			let rules = sheet.rules || sheet.cssRules;
			for (let ir=rules.length; ir-->0;) {
				let	rule = rules[ir];
				if (!rule.selectorText) continue;
				let match = rule.selectorText.match(regex);
				if (!match) continue;
				let bg = rule.style.getPropertyValue(property);
				if (match.length===1) return bg;
				matches.push({ num:+match[1], bg:bg });
			}
		}
		return matches
		.sort(function(a, b){ return a.num-b.num })
		.map(function(a){ return a.bg });
	}

	skin.wzincolors = {
		conv:  skin.getCssValue(/^\.wzin-conv-(\d+)$/, "background-color"),
		edit:  skin.getCssValue(/^\.wzin-edit$/, "background-color"),
		reply: skin.getCssValue(/^\.wzin-reply$/, "background-color"),
		link:  skin.getCssValue(/^\.wzin-link$/, "background-color")
	}

	skin.getColourRange = function(selector){
		return ["background-", ""].map(function(k){
			let c = skin.getCssValue(selector, k + "color"); // received as rgb(x,x,x)
			return c.match(/[\d]+/g).map(function(v){
				return Number.parseInt(v, 10);
			});
		});
	}

	skin.foregroundColourRange = skin.getColourRange(/^\.generated-color$/);

	skin.stringToColour = function(str){
		if (!str) return "#888";
		let	i,
			hash = 0;
		for (i=0; i<str.length; i++) {
			hash = str.charCodeAt(i) + (hash << 5) - hash;
		}
		let colour = '#';
		for (i=0; i<3; i++) {
			let value = (hash >> (i * 8)) & 0xFF;
			let	min = skin.foregroundColourRange[0][i],
				max = skin.foregroundColourRange[1][i];
			value = min + (max-min)*value/255|0;
			colour += ('00' + value.toString(16)).substr(-2);
		}
		return colour;
	}


	function colorize(logo){
		$('path', logo.getSVGDocument()).css('stroke', skin.getCssValue(/^\.Miaou-logo$/, 'color'));
	}
	$(".Miaou-logo").each(function(){
		if (this.getSVGDocument()) {
			colorize(this);
			return;
		}
		this.addEventListener("load", function(){
			colorize(this);
		});
	});

});
