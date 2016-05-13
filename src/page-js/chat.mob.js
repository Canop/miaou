
miaou(function(chat, locals, prof){
	var	me = locals.me,
		room = locals.room;

	if (!room) {
		location = 'rooms';
	}
	if (room.private) {
		$('#roomname').addClass('private').attr('title', 'This room is private');
	}
	$('#help').click(function(){ window.open('help#Writing_Messages') });
	$('#changeroom').click(function(){ location = 'rooms' });
	$('#shortcuts').click(function(){ window.open('help#All_Shortcuts') });
	$('#me').text(me.name);
	$('.tab').click(function(){
		$('.tab').removeClass('selected');
		$(this).addClass('selected');
		$('.page').removeClass('selected').filter('#'+$(this).attr('page')).addClass('selected');
	});

	$('.mtab').click(function(){
		$(this).toggleClass('open closed');
		$('.mpage').eq($(this).index()).toggle();
	});
	$('#editProfile').click(function(){
		location = 'prefs';
	});

	// profile opening
	$('#messages').on('click', '.decorations', function(e){
		if ($(e.target).hasClass('decorations')) {
			prof.toggle.call(this);
			return false; // prevent message buttons
		}
	});
	// profile closing
	$(document.body).click(function(){
		if (prof.displayed()) {
			prof.hide();
		}
	});

	chat.start();
});
