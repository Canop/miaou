
miaou(function(chat, locals, roomFinder, time, watch, ws){

	var openpaneltimer, showroomstimer;
	function openRoomsPanel(){
		if ($('#rooms-panel').hasClass('open')) return;
		$('#rooms').hide();
		roomFinder.open();
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

	$('#watches').on('mouseenter', '.watch', hideRoomsPanel);
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
			$('#search-input').focus();
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

	$('#M-menu').on('mouseenter', function(){
		hideRoomsPanel();
		$(this).addClass('open');
	}).on('mouseleave', function(){
		$(this).removeClass('open');
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
		}
	});

	$('#shortcuts').click(function(){ window.open('help#Keyboard_Shortcuts') });

	$(window).on('keyup', function(e){
		if (e.which === 35 && !$('#rooms-panel').hasClass('open')) { // end
			miaou.gui.scrollToBottom();
		}
		if ((e.ctrlKey && !e.shiftKey && !e.altKey) && e.which===32) { // ctrl - space
			toggleRoomsPanel();
			return false;
		}
	});

	$("#input").click(hideRoomsPanel);

	$("#search-options-open").click(function(){
		$("#search-options, #search-options-open").toggleClass("open");
	});
	$(".search-options-details").click(function(){
		$(this).closest(".search-input-line").children("input").prop("checked", true);
	});

	let	inputSizes = ["small", "medium", "big"],
		currentSizeIndex = 1;
	$("#input-grower").click(function(){
		$("#input-panel").removeClass(inputSizes[currentSizeIndex]);
		currentSizeIndex++;
		if (currentSizeIndex>=inputSizes.length-1) {
			currentSizeIndex = inputSizes.length-1;
			$(this).removeClass("enabled");
		}
		$("#input-panel").addClass(inputSizes[currentSizeIndex]);
		$("#input-shrinker").addClass("enabled");
	});
	$("#input-shrinker").click(function(){
		$("#input-panel").removeClass(inputSizes[currentSizeIndex]);
		currentSizeIndex--;
		if (currentSizeIndex<=0) {
			currentSizeIndex = 0;
			$(this).removeClass("enabled");
		}
		$("#input-panel").addClass(inputSizes[currentSizeIndex]);
		$("#input-grower").addClass("enabled");
	});

});
