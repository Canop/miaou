miaou(function(locals){

	var	m = location.toString().match(/room=(\d+)/),
		strategies = locals.oauth2Strategies;
	if (m) {
		localStorage['login.room'] = m[1];
	} else {
		delete localStorage['login.room'];
	}
	if (localStorage['successfulLoginLastTime'] && localStorage['lastUsedStrategy'] && strategies[localStorage['lastUsedStrategy']]) {
		delete localStorage['successfulLoginLastTime'];
		$('#buttons').html('<i>Authentication in progress...</i>');
		$('.toRemoveWhenLogin').remove();
		setTimeout(function(){ location = strategies[localStorage['lastUsedStrategy']].url }, 100);
	} else {
		var names = {
			google: "<span class=icon>&#xe818;</span> Google",
			stackexchange: "<span class=icon>&#xe816;</span> StackExchange",
			github: "<span class=icon>&#xe817;</span> GitHub",
			reddit: "<span class=icon>&#xe819;</span> reddit"
		};
		for (var key in strategies) {
			(function(key, strategy){
				$('<button>').html(names[key]||key).click(function(){
					localStorage['lastUsedStrategy'] = key;
					location = strategy.url;
				}).appendTo('#buttons');
			})(key, strategies[key]);
		}
	}

});
