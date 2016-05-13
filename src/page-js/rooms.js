
miaou(function(locals, notif, roomFinder){

	var	langs = locals.langs,
		loginRoom = localStorage['login.room'];

	if (loginRoom) {
		delete localStorage['login.room'];
		location = loginRoom;
	}
	delete localStorage['room'];

	function roomWatch(roomId){
		for (var i=0; i<locals.watches.length; i++) {
			if (locals.watches[i].id===roomId) return locals.watches[i];
		}
	}

	function hasPing(roomId){
		for (var i=0; i<locals.pings.length; i++) {
			if (locals.pings[i].room===roomId) return true;
		}
	}

	$('#logout').click(function(){
		delete localStorage['successfulLoginLastTime'];
		setTimeout(function(){ location = 'logout' }, 100);
	});

	function applyLangs(trans){
		$.each(langs, function(key, lang){
			var $lang = $(document.getElementById(key));
			$('.room.'+key)[lang.on ? 'show' : 'hide'](trans*800);
			if (lang.on) {
				$lang.addClass('on').removeClass('off')
				.attr('title', 'Rooms in '+lang.name+' are displayed. Click to hide them.');
			} else {
				$lang.removeClass('on').addClass('off')
				.attr('title', 'Rooms in '+lang.name+' are hidden. Click to display them.');
			}
		});
	}
	$.each(langs, function(key, lang){
		var $lang = $(document.getElementById(key));
		lang.on = localStorage[key] !== 'off';
		$lang.click(function(){
			lang.on = !lang.on;
			localStorage[key] = lang.on ? 'on' : 'off';
			applyLangs(true);
		});
	});

	roomFinder.open(
		applyLangs,
		{
			getWatch: roomWatch,
			hasPing: hasPing
		}
	);
});
