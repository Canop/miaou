
miaou(function(plugins, prefs){

	function showConnect(){
		let list = prefs.get("connecticats.list");
		if (!list || list=="none") return;
		var url = miaou.root + "connecticats?list=" + list;
		setTimeout(function(){
			$("#chat-connecting")
			.prop("className", "") // remove the eventual classes of other plugins
			.empty()
			.addClass("connecticat")
			.css('background-image', "url("+url+")")
		}, 0);
	}

	plugins["connecticats"] = {
		start: showConnect
	};

});


