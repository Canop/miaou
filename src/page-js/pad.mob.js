
miaou(function(chat, ed, gui, locals, prof, time, watch, ws){

	// Global working of all tabs
	var tabs = chat.tabs = {};
	function Tab(id){
		this.id = id;
		this.$tab = $('#mpad-tab-'+id);
		this.$page = $('#mpad-page-'+id).hide();
		this.bindEvents();
	}
	chat.closeAllTabs = function(){ // for now this only exists when the chat is mobile
		for (var tabId in tabs) {
			tabs[tabId].close();
		}
	}
	var Tabs = Tab.prototype;
	Tabs.open = function(cb){
		this.$tab.addClass('open');
		this.$page.addClass('open').slideDown(cb);
		$('#mpad-untabber').show();
	}
	Tabs.close = function(cb){
		this.$tab.filter('.open').removeClass('open');
		this.$page.filter('.open').removeClass('open').slideUp(cb);
		$('#mpad-untabber').hide();
	}
	Tabs.bindEvents = function(){
		var tab = this;
		this.$tab.click(function(){
			if (tab.$tab.hasClass('open')) {
				tab.close();
			} else {
				chat.closeAllTabs();
				tab.open();
			}
		});
	}
	;['room', 'notables', 'search', 'watches', 'users', 'menu', 'write'].forEach(function(tabId){
		tabs[tabId] = new Tab(tabId);
	});
	$('#mpad-untabber').click(chat.closeAllTabs);

	// "room" tab
	tabs["room"].open = function(cb){
		$('#watch-button').text(locals.room.watched ? 'unwatch' : 'watch');
		Tabs.open.call(this, cb);
	}

	// "notables" tab
	tabs["notables"].open = function(cb){
		Tabs.open.call(this, function(){
			$('#mpad-page-notables').renderMessages();
			if (cb) cb();
		});
	}
	$('#notable-messages,#search-results').on('click', '.message', chat.closeAllTabs);

	// "search" tab
	tabs["search"].open = function(cb){
		Tabs.open.call(this, cb);
		$('#search-input').focus();
	}
	tabs["search"].close = function(){
		$('#search-input').blur();
		Tabs.close.call(this);
	}

	// "write" tab (the one with the input)
	tabs['write'].open = function(){
		var iab = gui.isAtBottom();
		this.$tab.addClass('open');
		this.$page.addClass('open').show();
		if (iab) gui.scrollToBottom();
		$('.mpad-tabs').hide();
		$('#input').focus();
	}
	tabs['write'].close = function(){
		$('#input').blur();
		this.$tab.filter('.open').removeClass('open');
		this.$page.filter('.open').removeClass('open').hide();
		$('.mpad-tabs').show();
	}
	$('#cancel-write').click(function(){
		chat.closeAllTabs();
		ed.cancelEdit();
		ed.cancelReply();
	});
	$('#send').click(chat.closeAllTabs);
	chat.on("sending_message", chat.closeAllTabs);

	$('#messages').on('click', '.replyButton,.editButton', function(){
		tabs['write'].open();
	});

	if (!locals.room) location = 'rooms';
	if (locals.room.private) {
		$('#roomname').addClass('private');
	}
	if (locals.room.dialog) {
		$('#auths').hide();
	}
	$('#watch-button').click(function(){
		var r = locals.room;
		if (r.watched) {
			ws.emit('unwat', r.id);
			$(this).text('watch');
		} else {
			ws.emit('wat', r.id);
			$(this).text('unwatch');
		}
	});
	$('#menu-logout').click(function(){
		delete localStorage['successfulLoginLastTime'];
		setTimeout(function(){ location = 'logout' }, 100);
	});
	$('#menu-settings').attr('href', "prefs?room="+locals.room.id);
	$('#changeroom').click(function(){ location = 'rooms' });
	$('#me').text(locals.me.name);

	$('#users').on('click', '.user', prof.toggle);

	$('#uploadOpen').click(function(){
		$('#upload-panel').show();
		$('#input-panel').hide();
	});
	$('#cancelUpload').click(function(){
		$('#upload-panel').hide();
		$('#input-panel').show();
	});

	var ready = false;
	chat.on("ready", function(){
		if (ready) return;
		$("<div id=global-watch>")
		.addClass("mpad-tab-label fontello mpad-icon icon-eye")
		.appendTo("#mpad-tab-watches");
		ready = true;
	});

	watch.enabled = true;
	chat.start();

});
