
miaou(function(chat, locals, watch, ws){
	var	me = locals.me,
		room = locals.room,
		rooms = [];

	// ROOMS MANAGEMENT
	
	function updateRooms(){
		$('#rooms-content').hide();
		$('#rooms-spinner').show();
		$.get('json/rooms', function(data){
			rooms = data.rooms;
			selectRoomsTab(0);
			$('#rooms-spinner').hide();
			$('#rooms-content').show();
		});
	}
	
	function listRooms(roomlist, title){
		var $list = $('<div>').addClass('rooms-list').append(roomlist.map(function(r){
			var $r = $('<div>').addClass('room'),
				$rl = $('<div>').addClass('room-left').appendTo($r),
				$rr = $('<div>').addClass('room-right').appendTo($r),
				$rm = $('<div>').addClass('last-message').appendTo($r),
				iswatched = watch.watched(r.id),
				path = r.path+'&pad=true';
			$('<a>').attr('href', path).addClass('room-title').text(r.name).appendTo($rl);
			var html = miaou.mdToHtml(r.description), floatImage = /^<img[^>]*><br>/.test(html);
			if (floatImage) html = html.replace(/<br>/,'');
			var $desc = $('<div>').addClass('rendered room-desc').html(html).appendTo($rl);
			if (floatImage) $desc.find('img:eq(0)').css('float','left').css('margin-right','3px').click(function(){ location=r.path });
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
				$('<button>').addClass('small').text('enter').click(function(){ location = path; }).appendTo($rr);
			}
			if (r.lastcreated) {
				var $lc = $('<span>').addClass('lastcreated').text('Last message: '+miaou.formatRelativeTime(r.lastcreated)).appendTo($rr);
				$lc.mouseenter(function(){
					$.get('json/messages/last?room='+r.id, function(data){
						var m = data.messages[0];
						$lc.text('Last message: '+miaou.formatRelativeTime(m.created));
						$rm.empty().css('top',$r.height()+'px').show().append(
							$('<i>').text(m.authorname+': ')
						).append(
							$('<span>').text(m.content.match(/^[^\n]{0,100}/)[0])
						);
					});
				});
				$r.mouseleave(function(){
					$rm.hide();
				});
			}
			return $r;
		}));
		if (title) $('<h3>').text(title).prependTo($list);
		$list.appendTo('#rooms-page');
	}
	
	function selectRoomsTab(i){
		$('#rooms-tabs .tab').removeClass('selected').eq(i).addClass('selected');
		$('#rooms-page').empty();
		switch (i){
		case 0:
			listRooms(
				rooms.filter(function(r){ return !r.private && (r.lastcreated || r.auth)})
				, 'Your Public Rooms'
			);
			listRooms(
				rooms.filter(function(r){ return r.private && r.auth && !r.dialog })
				, 'Your Private Rooms'
			);
			break;
		case 1:
			listRooms(
				rooms.filter(function(r){ return !r.private })
				.sort(function(a,b){ return b.messagecount-a.messagecount })
			);
			break;
		case 2:
			listRooms(
				rooms.filter(function(r){ return r.private && !r.dialog })
				.sort(function(a,b){ return b.messagecount-a.messagecount })
			);
			break;
		case 3:
			listRooms(
				rooms.filter(function(r){ return r.dialog })
				.sort(function(a,b){ return b.lastcreated-a.lastcreated })
			);
			break;
		}
	}
	
	$('#rooms-tabs .tab').click(function(){
		selectRoomsTab($(this).index());
	});
	
	var showroomstimer;
	function showRoomsPanel(){
		if ($('#room-and-rooms').hasClass('open')) return;
		$('#rooms').hide();
		updateRooms();
		$('#room-and-rooms').addClass('open').removeClass('closed');
		showroomstimer = setTimeout(function(){
			$('#rooms').fadeIn("fast");
		}, 500); // ensure the div is high enough
	}
	function hideRoomsPanel(){
		clearTimeout(showroomstimer);
		$('#rooms-content').hide();
		$('#room-and-rooms').addClass('closed').removeClass('open');		
	}
	
	$('#rooms-content').hide();
	$('#room-and-rooms').on('mouseenter', showRoomsPanel);
	$('#stripe').on('mouseleave', hideRoomsPanel);


	// CHAT MANAGEMENT

	if (room) window.name = 'room_'+room.id;
	else location = 'rooms';
	if (room.private) {
		$('#roomname').addClass('private').attr('title', 'This room is private');
	}
	if (room.dialog) {
		$('#auths,#editroom').hide();
	}
	$('#shortcuts').click(function(){ window.open('help#All_Shortcuts') });

	function righttab(page){
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

	$(window).on('keydown', function(e){
		if (e.which===70 && e.ctrlKey && $('#room-and-rooms').hasClass('open')) {
			righttab("search");
			return false;
		}
	});
	chat.start();
	$(window).keyup(function(e){
		if ($('#room-and-rooms').hasClass('open')) {
			if (e.which===35) miaou.gui.scrollToBottom();
		}
	});


});
