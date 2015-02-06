miaou(function(chat, locals){
	var	me = locals.me,
		room = locals.room;

	if (room) window.name = 'room_'+room.id;
	else location = 'rooms';
	if (room.private) {
		$('#roomname').addClass('private').attr('title', 'This room is private');
	}
	if (room.dialog) {
		$('#auths,#editroom').hide();
	}
	$('#help').click(function(){ window.open('help') });
	$('#changeroom').click(function(){ window.open('rooms') });
	$('#shortcuts').click(function(){ window.open('help#All_Shortcuts') });
	$('#me').text(me.name).append(' <span class=icon>\ue828</span>').attr('href', "prefs?room="+room.id);

	function tab(page){
		$('.tab').removeClass('selected');
		$('.tab[page='+page+']').addClass('selected');
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
	$('.tab').click(function(){
		tab($(this).attr('page'));
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
		if (e.which===70 && e.ctrlKey) {
			tab("search");
			return false;
		}
	});
	chat.start();
	$(window).keyup(function(e){
		if (e.which===35) miaou.gui.scrollToBottom();
	});
});
