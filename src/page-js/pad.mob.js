miaou(function(chat, locals, time, watch, ws){
	$('.mpad-tab').click(function(){
		var	$this =$(this),
			tabId = this.id.split('-')[2];
		console.log(tabId);
		$('.mpad-page.open').removeClass('open').slideUp();
		if ($this.hasClass('open')) {
			// closing the page
			$this.removeClass('open');
		} else {
			// opening the page
			$('#mpad-page-'+tabId).addClass('open').slideDown();
			$('.mpad-tab').removeClass('open');
			$this.addClass('open');
			if (tabId==='write') {
				$('#input').focus();
			}
		}
	});
	function closeAllTabs(){
		$('.mpad-page.open').removeClass('open').slideUp();
		$('.mpad-tab').removeClass('open');
	}
	$('#cancel-write').click(closeAllTabs);
	$('#send').click(closeAllTabs);


	if (!locals.room) location = 'rooms';
	if (locals.room.private) {
		$('#roomname').addClass('private');
	}
	if (locals.room.dialog) {
		$('#auths').hide();
	}
	$('#menu-logout').click(function(){
		delete localStorage['successfulLoginLastTime'];
		setTimeout(function(){ location = 'logout' }, 100);
	});
	$('#me').text(locals.me.name);

	chat.start();
});
