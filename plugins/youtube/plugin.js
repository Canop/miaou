

exports.init = function(miaou){
	miaou.lib("prefs").definePref(
		"youtube.expand", "yes", "Show Youtube videos",
		[ "no", "yes" ]
	);
}

