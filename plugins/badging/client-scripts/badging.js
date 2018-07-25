miaou(function(plugins, ed, fmt, md){

	function nv(n, v){
		return "<span class=faded-8>" + n + ":</span> " + v;
	}

	function nbu(nb){
		if (!nb) return "nobody";
		if (nb===1) return "1 user";
		return nb + " users";
	}

	function blower($c){
		var	match = $c.text().match(/^\s*([\w-]{3,50})\s*\/\s*(.*\S)\s*$/);
		if (!match) {
			console.log("bad content:", $c.text());
			return;
		}
		var	tag = match[1],
			name = match[2];
		$.get("json/badge?tag="+tag+"&name="+encodeURIComponent(name), function(data){
			var badge = data.badge;
			if (!badge) {
				$c.text("Unknown Badge");
				return;
			}
			$c.addClass("text").html([
				"<span class="+badge.level+"-badge>"+badge.name+"</span><br>",
				fmt.mdTextToHtml(badge.condition) + "<br>",
				nv("tag", badge.tag),
				nv("level", badge.level),
				nv("attribution", (badge.manual ? "manual" : "automated")),
				nv("awarded to", nbu(badge.awards))
			].join("<br>"));
		});
	}

	// improve the rendering of badge elements:
	// - remove from display the tag (i.e. change "Miaou/Writer" to "Writer")
	// - bind bubbling to display the tag and condition (and more?)
	function decorateBadges($c){
		$c.find(".bronze-badge, .silver-badge, .gold-badge").each(function(){
			var	$badge = $(this),
				con = $badge.text().trim().split("/"),
				name = con.pop(),
				tag = con[0]||"Miaou";
			$badge.text(name).bubbleOn({
				text: tag + " / " + name,
				blower: blower
			});
		});
	}

	plugins["badging"] = {
		start: function(){
			ed.registerCommandArgAutocompleter("badge", ["award", "ladder", "list"]);
			fmt.whiteListBraceSpanClass("bronze-badge");
			fmt.whiteListBraceSpanClass("silver-badge");
			fmt.whiteListBraceSpanClass("gold-badge");
			md.registerRenderer(decorateBadges, true);
		}
	}

});

