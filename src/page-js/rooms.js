
miaou(function(locals){
	
	var	mobile = locals.mobile,
		rooms = locals.rooms,
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

	function selectTab(i) {
		$('.home-tab').removeClass('selected').filter(':nth-child('+(i+1)+')').addClass('selected');
		var $container = $('#home-main-content > .table').empty();
		switch(i){
		case 0:
			if (mobile) {
				$container.append(
					$('<div>').addClass('CL').append(
						$('<h3>').text('Your Rooms')
					).append(
						table(
							rooms.filter(function(r){
								return (r.hasself || r.auth) && !r.dialog
							}),
							"You didn't participate in any non dialog room."
						)
					)
				);		
			} else {
				var userPublicRooms = rooms.filter(function(r){
					return !r.private && (r.hasself || r.auth)
				});
				var userPrivateRooms = rooms.filter(function(r){
					return r.private && r.auth && !r.dialog
				});
				
				if (userPublicRooms.length+userPrivateRooms.length===0) {
					$container.append(
						$('<div>').addClass('CC').addClass('welcome-rooms').append(
							table(locals.welcomeRooms)
						)
					);
				} else {
					$container.append(
						$('<div>').addClass('CL').append(
							$('<h3>').text('Your Public Rooms')
						).append(table(
							userPublicRooms,
							"You didn't participate in any public room for now."
						))
					).append($('<div>').addClass('CR').append(
							$('<h3>').text('Your Private Rooms')
						).append(table(
							userPrivateRooms,
							"You have access to no private room for now.<br>"+
							"To enter a private room, click on its link (<a href=# onclick='selectTab(2)'>see them</a>)"+
							" and request an access"
						))
					);					
				}
			}
			break;
		case 1:
			$container.append(
				$('<div>').addClass('CC').append(
					$('<h3>').text('Main Public Rooms')
				).append(
					table(
						rooms.filter(function(r){
							return !r.private
						}).sort(function(a,b){ return b.lastcreated-a.lastcreated }),
						"There doesn't seem to be any public room on this server."
					)
				)
			);
			break;
		case 2:
			$container.append(
				$('<div>').addClass('CC').append(
					$('<h3>').text('Main Private Rooms')
				).append(
					table(
						rooms.filter(function(r){
							return r.private && !r.dialog
						}).sort(function(a,b){ return b.lastcreated-a.lastcreated }),
						"There doesn't seem to be any listed private room on this server."
					)
				)
			);
			break;
		case 3:
			$container.append(
				$('<div>').addClass('CC').append(
					$('<h3>').text('Rooms for Two')
				).append(
					table(
						rooms.filter(function(r){
							return r.dialog
						}).sort(function(a,b){ return b.lastcreated-a.lastcreated }),
						"Dialog rooms are created by sending a Private Message to another user. You have none for now."
					)
				)
			);
			break;
		}
		if ($(window).scrollTop()>tabletop) $(window).scrollTop(tabletop);
		applyLangs();
	}
	selectTab(0);
	$('.home-tab').click(function(){
		selectTab($(this).index());
	});			
	$('#logout').click(function(){
		delete localStorage['successfulLoginLastTime'];
		setTimeout(function(){ location = 'logout' }, 100);
	});

	function applyLangs(trans){
		$.each(langs, function(key, lang){
			var $lang = $(document.getElementById(key));
			$('tr.'+key)[lang.on ? 'show' : 'hide'](trans*800);
			if (lang.on) {
				$lang.addClass('on').attr('title', 'Rooms in '+lang.name+' are displayed. Click to hide them.');
			} else {
				$lang.removeClass('on').attr('title', 'Rooms in '+lang.name+' are hidden. Click to display them.');				
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
	applyLangs();

});
