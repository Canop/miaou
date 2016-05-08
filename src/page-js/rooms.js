
miaou(function(locals, roomFinder){
	
	var	mobile = locals.mobile,
		langs = locals.langs,
		tabletop = mobile ? 200 : 250,
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

	function hasPings(roomId){
		for (var i=0; i<locals.pings.length; i++) {
			if (locals.pings[i].room===roomId) return true;
		}
	}

	function list(rooms, alt){
		if (rooms.length) {
			var $t = $('<div>').addClass('room-list'), rex = /^<img[^>]*><br>/;
			rooms.forEach(function(r){
				var $room = $("<div>").addClass("room").addClass(r.lang).addClass(r.private?'private':'public');
				var $roomHead = $("<div>").addClass("room-head").appendTo($room);
				$("<div>").addClass("room-privacy").appendTo($roomHead);
				// var $roomTitle = $("<div>").addClass("room-title").appendTo($roomHead);
				$('<a>').addClass("room-title").attr('href', r.path).text(r.name).appendTo($roomHead);
				var	html = miaou.fmt.mdTextToHtml(r.description),
					floatImage = rex.test(html);
				if (floatImage) html = html.replace(/<br>/,'');
				var $underDescription = $('<div>').addClass('under-room-description')
				.appendTo($room);
				var $description = $('<div>').addClass('room-description rendered').html(html)
				.appendTo($underDescription);
				if (floatImage) {
				 	var bgsrc = $description.find('img:eq(0)').remove().attr('src');
					$underDescription.css('background-image', 'url("'+bgsrc+'")');
				 }
				var w = roomWatch(r.id);
				if (w) {
					var $unseen = $('<span>').addClass('watch-count').text(w.nbunseen);
					var txt = "You're watching this room.";
					if (w.nbunseen) {
						$unseen.addClass('has-unseen');
						txt += " There's "+w.nbunseen+" new message";
						if (w.nbunseen>1) txt += "s";
						txt += ".";
						if (hasPings(r.id)) {
							$unseen.addClass('has-ping');
							txt += " You were also pinged here.";
						}
					} else {
						txt += " There's no new message.";
					}
					$unseen.attr('title', txt).appendTo($roomHead);
				}
				$room.appendTo($t).click(function(){
					location = r.path;
				});
			});
			return $t;
		} else {
			return $('<p>').html(alt);
		}
	}
	function table(rooms, alt){
		if (rooms.length) {
			var $t = $('<table>').addClass('list'), rex = /^<img[^>]*><br>/;
			rooms.forEach(function(r){
				var $roomName = $('<td>').addClass(r.private?'private':'public').append(
					$('<a>').addClass("room-name").attr('href',r.path).text(r.name)
				).addClass('room-title-cell');
				var html = miaou.fmt.mdTextToHtml(r.description), floatImage = rex.test(html);
				if (floatImage) html = html.replace(/<br>/,'');
				var $description = $('<td>').addClass('rendered').html(html);
				if (floatImage) {
					$description.find('img:eq(0)').css('float','left').css('margin-right','3px')
					.click(function(){ location=r.path });
				}
				var w = roomWatch(r.id);
				if (w && w.nbunseen) {
					var $unseen = $('<span>').addClass('watch-count').text(w.nbunseen);
					if (w.nbunseen) $unseen.addClass('has-unseen');
					$unseen.appendTo($roomName);
				}
				$('<tr>').addClass(r.lang).addClass('room')
				.append($roomName).append($description)
				.appendTo($t);
			});
			return $t;
		} else {
			return $('<p>').html(alt);
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
			getWatch: roomWatch
		}		
	);
});
