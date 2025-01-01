
miaou(function(locals, notif, roomFinder){

	let	langs = locals.langs,
		loginRoom = localStorage.getItem('login.room');

	if (loginRoom) {
		localStorage.removeItem('login.room');
		document.location = loginRoom;
	}
	localStorage.removeItem('room');

	function roomWatch(roomId){
		for (let i=0; i<locals.watches.length; i++) {
			if (locals.watches[i].id===roomId) return locals.watches[i];
		}
	}

	function hasPing(roomId){
		for (let i=0; i<locals.pings.length; i++) {
			if (locals.pings[i].room===roomId) return true;
		}
	}

	$('#logout').click(function(){
		localStorage.removeItem('successfulLoginLastTime');
		setTimeout(function(){ document.location = 'logout' }, 100);
	});

	function applyLangs(trans){
		$.each(langs, function(key, lang){
			let $lang = $(document.getElementById(key));
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
		let $lang = $(document.getElementById(key));
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
