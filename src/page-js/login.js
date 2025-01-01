miaou(function(locals){

	let	m = location.toString().match(/room=(\d+)/),
		strategies = locals.oauth2Strategies;
	if (m) {
		localStorage['login.room'] = m[1];
	} else {
		localStorage.removeItem('login.room');
	}
	if (
		localStorage['successfulLoginLastTime']
		&& localStorage['lastUsedStrategy']
		&& strategies[localStorage['lastUsedStrategy']]
	) {
		localStorage.removeItem('successfulLoginLastTime');
		$('#buttons').html('<i>Authentication in progress...</i>');
		$('.toRemoveWhenLogin').remove();
		setTimeout(function(){ document.location = strategies[localStorage['lastUsedStrategy']].url }, 100);
	} else {
		let names = {
			google: "<span class=icon-gplus></span> Google",
			stackexchange: "<span class=icon-stackoverflow></span> StackOverflow",
			github: "<span class=icon-github></span> GitHub",
			reddit: "<span class=icon-reddit></span> reddit"
		};
		let bubbles = {
			stackexchange: "Warning: only use this if you have an existing StackOverflow account "+
				"(not just StackExchange)"
		};
		for (let key in strategies) {
			(function(key, strategy){
				let $button = $('<button>').html(names[key]||key).click(function(){
					localStorage['lastUsedStrategy'] = key;
					document.location = strategy.url;
				});
				if (bubbles[key]) $button.bubbleOn({
					text: bubbles[key],
					side: "bottom"
				});
				$button.appendTo('#buttons');
			})(key, strategies[key]);
		}
	}

});
