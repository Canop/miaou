
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

	var authDescriptions = {
		read: 'You can only read in this room',
		write: 'You can read and write in this room',
		admin: "You're an administrator of this room : you can change its name and description, give or revoke writing rights, and give admin rights.",
		own: "You're an owner of this room : you can change its name and description, give or revoke writing and admin rights, and give owner rights."
	}
	function table(rooms,alt){
		if (rooms.length) {
			var $t = $('<table>').addClass('list'), rex = /^<img[^>]*><br>/;
			rooms.forEach(function(r){
				var html = miaou.fmt.mdTextToHtml(r.description), floatImage = rex.test(html);
				if (floatImage) html = html.replace(/<br>/,'');
				var $td = $('<td>').addClass('rendered').html(html);
				if (floatImage) $td.find('img:eq(0)').css('float','left').css('margin-right','3px').click(function(){ location=r.path });
				var $tr = $('<tr>').addClass(r.lang).append(
					$('<td>').addClass(r.private?'private':'public').append($('<a>').attr('href',r.path).text(r.name))
				).append($td).appendTo($t);
				if (r.auth && !r.dialog) $tr.append($('<td>').addClass('role').text(r.auth).attr('title', authDescriptions[r.auth]));
			});
			return $t;
		} else {
			return $('<p>').html(alt);
		}
	}			

	function selectTab(i) {
		$('.tab').removeClass('selected').filter(':nth-child('+(i+1)+')').addClass('selected');
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
								return (r.lastcreated || r.auth) && !r.dialog
							}),
							"You didn't participate in any non dialog room."
						)
					)
				);		
			} else {
				var userPublicRooms = rooms.filter(function(r){
					return !r.private && (r.lastcreated || r.auth)
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
							"To enter a private room, click on its link (<a href=# onclick='selectTab(2)'>see them</a>) and request an access"
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
						}).sort(function(a,b){ return b.messagecount-a.messagecount }),
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
						}).sort(function(a,b){ return b.messagecount-a.messagecount }),
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
	}
	selectTab(0);
	//~ if (!$('#home-main-content tr').length) selectTab(1);
	$('.tab').click(function(){
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
