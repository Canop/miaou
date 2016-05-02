
miaou(function(chat, locals, time, watch, ws){

	var	rooms = [];

	// ROOMS MANAGEMENT
	
	function fetchRooms(){
		var pat = $("#room-search-input").val();
		$("#room-search-reset").toggleClass("visible", !!pat);
		$.get('json/rooms?pattern='+encodeURIComponent(pat), function(data){
			if (pat!==$("#room-search-input").val()) {
				console.log("received obsolete search result", pat);
				return;
			}
			rooms = data.rooms;
			updateRoomsTab();
		});
	}

	function updateRoomsTab(){
		var i = $('#rooms-tabs .tab.selected').index();
		$('#rooms-page').empty();
		switch (i){
		case 0:
			listRooms(
				rooms.filter(function(r){ return !r.private && (r.hasself || r.auth)})
				, 'Your Public Rooms'
			);
			listRooms(
				rooms.filter(function(r){ return r.private && r.auth && !r.dialog })
				, 'Your Private Rooms'
			);
			break;
		case 1:
			listRooms(rooms.filter(function(r){ return !r.private }));
			break;
		case 2:
			listRooms(rooms.filter(function(r){ return r.private && !r.dialog }));
			break;
		case 3:
			listRooms(rooms.filter(function(r){ return r.dialog }));
			break;
		}
	}
	
	function listRooms(roomlist, title){
		roomlist = roomlist.filter(function(r){ return r.id!==locals.room.id });
		var $list = $('<div>').addClass('rooms-list').append(roomlist.map(function(r){
			var $r = $('<div>').addClass('room'),
				$rl = $('<div>').addClass('room-left').appendTo($r),
				$rr = $('<div>').addClass('room-right').appendTo($r),
				iswatched = watch.watched(r.id);
			$('<a>').attr('href', r.path).addClass('room-title').text(r.name).appendTo($rl);
			var html = miaou.fmt.mdTextToHtml(r.description), floatImage = /^<img[^>]*><br>/.test(html);
			if (floatImage) html = html.replace(/<br>/,'');
			var $desc = $('<div>').addClass('rendered room-desc').html(html).appendTo($rl);
			if (floatImage) {
				$desc.find('img:eq(0)').css('float','left').css('margin-right','3px')
				.click(function(){ location=r.path });
			}
			if (r.id===locals.room.id) {
				$('<span>').text("You're in that room").appendTo($rr);
			} else {
				$('<button>').addClass('small').text(iswatched ? 'unwatch' : 'watch').click(function(){
					if (iswatched) {
						ws.emit('unwat', r.id);
						$(this).text('watch');
					} else {
						ws.emit('wat', r.id);
						$(this).text('unwatch');
					}
					iswatched = !iswatched;
				}).appendTo($rr);
				$('<button>').addClass('small').text('enter')
				.click(function(){ location = r.path; }).appendTo($rr);
			}
			if (r.lastcreated) {
				$('<span>').addClass('lastcreated')
				.html('Last message:<br>'+time.formatRelativeTime(r.lastcreated)).appendTo($rr);
			}
			return $r;
		}));
		if (title) $('<h3>').text(title).prependTo($list);
		$list.appendTo('#rooms-page');
	}
	$('#rooms-page').on('mouseleave', '.room', function(){
		$('.last-message').hide();
	});
	
	function selectRoomsTab(i){
		$('#rooms-tabs .tab').removeClass('selected').eq(i).addClass('selected');
		updateRoomsTab();
	}
	
	$('#rooms-tabs .tab').click(function(){
		selectRoomsTab($(this).index());
	});
	
	var openpaneltimer, showroomstimer;
	function openRoomsPanel(){
		if ($('#rooms-panel').hasClass('open')) return;
		$('#rooms').hide();
		selectRoomsTab(0);
		fetchRooms();
		$('#rooms-panel').addClass('open').removeClass('closed');
		$('#stripe').addClass('open');
		$('#non-top').addClass('behind');
		showroomstimer = setTimeout(function(){
			$('#rooms').fadeIn("fast");
		$("#room-search-input").focus();
		}, 500); // ensure the div is high enough
	}
	function hideRoomsPanel(){
		clearTimeout(openpaneltimer);
		clearTimeout(showroomstimer);
		$('#rooms-panel').addClass('closed').removeClass('open');		
		$('#stripe').removeClass('open');		
		$('#non-top').removeClass('behind');
		$("#input").focus();
	}

	function toggleRoomsPanel(){
		if ($('#rooms-panel').hasClass('open')) hideRoomsPanel();
		else openRoomsPanel();
	}
	
	$('#room-panel').on('mouseenter', function(){
		openpaneltimer = setTimeout(openRoomsPanel, 180);
	})
	.on('mouseleave', function(){
		clearTimeout(openpaneltimer);		
	});
	$('#stripe').on('mouseleave', hideRoomsPanel);
	$('#room-watch').on('click', function(){
		ws.emit('wat', locals.room.id);
		locals.room.watched = true;
		$(this).hide();
		$("#room-unwatch").show();
	});
	$('#room-unwatch').hide().on('click', function(){
		ws.emit('unwat', locals.room.id);
		locals.room.watched = false;
		$(this).hide();
		$("#room-watch").show();
	});
	$('#menu-settings').attr('href', "prefs?room="+locals.room.id);

	// CHAT MANAGEMENT

	if (locals.room) window.name = 'room_'+locals.room.id;
	else location = 'rooms';
	if (locals.room.private) {
		$('#roomname').addClass('private').attr('title', 'This room is private');
	}
	if (locals.room.dialog) {
		$('#auths').hide();
	}

	var righttab = window.righttab = function(page){
		$('#right .tab').removeClass('selected');
		$('#right .tab[page='+page+']').addClass('selected');
		$('.page').removeClass('selected');
		$('#'+page).addClass('selected');
		if (page==="search") {
			miaou.hist.open();
			$('#searchInput').focus();
		} else if (page==="notablemessagespage") {
			miaou.hist.close();	
		}
		miaou.md.resizeAll();
	}
	$('#right .tab').click(function(){
		righttab($(this).attr('page'));
	});

	$('#uploadOpen').click(function(){
		$('#upload-panel').show();
		$('#input-panel').hide();
	});
	$('#cancelUpload').click(function(){
		$('#upload-panel').hide();
		$('#input-panel').show();
	});

	$('#menu-logout').click(function(){
		delete localStorage['successfulLoginLastTime'];
		setTimeout(function(){ location = 'logout' }, 100);
	});
	$('#me').text(locals.me.name);
	
	$('#create-room').click(function(){ location="room" });
	
	$('#Miaou-logo').on('load', function(){
		$('#M-menu').on('mouseenter', function(){
			hideRoomsPanel();
			$(this).addClass('open');
		}).on('mouseleave', function(){
			$(this).removeClass('open');
		});
	});

	$(window).on('keydown', function(e){
		if (e.which===70 && e.ctrlKey && !$('#rooms-panel').hasClass('open')) {
			righttab("search");
			return false;
		}
	});

	watch.enabled = true;
	chat.start();

	$("#room-search-input").keyup(function(e){
		if (e.which===27) { // esc
			if (! this.value) {
				hideRoomsPanel();
				return false;
			}
			this.value = '';
		}
		fetchRooms();
	});

	$("#room-search-reset").click(function(){
		$("#room-search-input").val('');
		fetchRooms();
	});

	$('#shortcuts').click(function(){ window.open('help#Keyboard_Shortcuts') });

	$(window).on('keyup', function(e){
		if (e.which === 35 && !$('#rooms-panel').hasClass('open')) { // end
			miaou.gui.scrollToBottom();
		}
		if ((e.ctrlKey && !e.shiftKey) && e.which===32) { // ctrl - space
			toggleRoomsPanel();
			return false;
		}
	});
});
