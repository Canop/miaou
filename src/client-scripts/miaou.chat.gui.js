var miaou = miaou || {};

miaou.bindChatGui = function(){
	var chat = miaou.chat,
		md = miaou.md,
		editor = miaou.editor,
		replyWzin;
	
	$('#messages, #notablemessages, #searchresults').on('click', '.message .content a[href]', function(e){
		var parts = this.href.match(/^([^?#]+\/)(\d+)(\?[^#?]*)?#?(\d+)?$/);
		if (parts && parts.length===5 && parts[1]===(location.origin+location.pathname).match(/(.*\/)[^\/]*$/)[1]) {
			// it's an url towards a room or message on this server
			if (room.id===+parts[2]) {
				// it's an url for the same room
				if (parts[4]) {
					// it's an url for a message
					md.focusMessage(+parts[4]);
				} else {
					// it's just an url to our room. Let's... err... scroll to bottom ?
					md.scrollToBottom();
				}
				e.preventDefault();
			} else {
				// it's an url for another room or for a message in another room, let's go to the right tab
				//  if it's already open, or open it if not
				this.target = 'room_'+parts[2];
				var h = parts[1]+parts[2];
				if (parts[3] && parts[3].indexOf('=')===-1) h += parts[3].slice('&')[0];
				h += h.indexOf('?')===-1 ? '?' : '&';
				h += 't='+Date.now();
				if (parts[4]) h += '#'+parts[4];
				this.href = h;
			}
		}
		e.stopPropagation();
	});
	
	$('#messages').on('click', '.message .content img', function(e){
		window.open(this.src);
		e.stopPropagation();
	})
	.on('click', '.opener', md.opener)
	.on('click', '.closer', md.closer)
	.on('click', '.editButton', function(){
		miaou.userProfile.hide();
		editor.editMessage($(this).closest('.message'));
	})
	.on('click', '.deleteButton', function(){
		miaou.userProfile.hide();
		var message = $(this).closest('.message').data('message');
		miaou.ms.updateStatus(message);
		var ismoddelete = !message.status.deletable && message.status.mod_deletable;
		var $content = $('<div>').append(
			$('<p>').text('Do you want to delete this message ?')
		).append(
			$('<p>').addClass('rendered').html(miaou.mdToHtml(message.content||''))
		).append(
			$('<p>').text("This can't be undone.")
		);
		
		if (ismoddelete) {
			$('<p>').addClass('warning')
			.text("Warning : You're not about to delete one of your recent messages but to use your moderator powers. Don't do that lightly.")
			.appendTo($content);
		}
		miaou.dialog({
			title: "Last warning before nuke",
			content: $content,
			buttons: {
				Cancel: null,
				Delete: function(){
					if (ismoddelete) miaou.socket.emit('mod_delete', [message.id]);
					else miaou.socket.emit('message', {id:message.id, content:''});
				}
			}
		});
	})
	.on('click', '.replyButton', function(){
		editor.replyToMessage($(this).closest('.message'));
	})
	.on('mouseenter', '.replyButton,.deleteButton,.editButton', miaou.userProfile.hide)
	.on('mouseleave', '.replyButton,.deleteButton,.editButton', miaou.userProfile.shownow)
	.on('mouseenter', '.reply', function(e){
		var $this = $(this),
			mid = $this.attr('to');
		miaou.wz.onmouseleave();
		var $target = $('#messages > .message').filter(function(){ return $(this).data('message').id==mid }).eq(0);
		if ($target.length) {
			if (replyWzin) replyWzin.remove();
			replyWzin = wzin($this.closest('.message'), $target, {
				zIndex:5, fill:'rgba(139, 69, 19, .2)', scrollables:'#messagescroller', parent:document.getElementById('messagescroller')
			});
		}
		e.stopPropagation();
	})
	.on('mouseleave', '.reply', function(){
		if (replyWzin) {
			replyWzin.remove();
			replyWzin = null;
		}
	})
	.on('mouseenter', '.message', miaou.wz.onmouseenter)
	.on('mouseleave', '.message', miaou.wz.onmouseleave)
	.on('click', '.reply', function(e){
		md.focusMessage(+$(this).attr('to'));
		e.stopPropagation();			
	})
	.on('click', '.vote', function(){
		var $e = $(this), message = $e.closest('.message').data('message'), vote = $e.attr('vote-level');
		if (message.vote) miaou.socket.emit('vote', {action:'remove',  message:message.id, level:message.vote});
		if (message.vote!=vote) miaou.socket.emit('vote', {action:'add',  message:message.id, level:vote});
		return false;
	})
	.on('click', '.unpin', function(){
		var m = $(this).closest('.message').data('message');
		miaou.dialog({
			title: "Unpin message",
			content: "If you confirm, you'll also remove the pin set by other(s) user(s)",
			buttons: {
				Cancel: null,
				Unpin: function(){
					miaou.socket.emit('unpin', m.id);
				}
			}
		});
		return false;
	})
	.on('click', '.makemwin', function(){
		var $e = $(this), message = $e.closest('.message').data('message');
		miaou.win.add(message);
		return false;
	})	
	.on('click', '.olderLoader', function(){
		var $this = $(this), mid = +$this.attr('mid'), olderPresent = 0;
		$this.remove();
		md.getMessages().forEach(function(m){ if (m.id<mid) olderPresent=m.id });
		miaou.socket.emit('get_older', {from:mid, until:olderPresent});
	})
	.on('click', '.newerLoader', function(){
		var $this = $(this), mid = +$this.attr('mid'), newerPresent = 0;
		$this.remove();
		md.getMessages().reverse().forEach(function(m){ if (m.id>mid) newerPresent=m.id });
		miaou.socket.emit('get_newer', {from:mid, until:newerPresent});
	})
	.on('click', '.pen', function(){
		miaou.mh.show($(this).closest('.message').data('message'));
	});
	
	if ($('#hist').length) {
		$('#messagescroller').on('scroll', miaou.hist.showPage);
	}
	
	if ($(document.body).hasClass('mobile')) {
		$('#messages').on('click', '.message', md.toggleMessageMenus)
		.on('click', '.user,.profile', miaou.userProfile.toggle);
		$(window).resize(md.scrollToBottom);
	} else {
		$('#messages,#users')
		.on('mouseenter', '.message', md.showMessageMenus).on('mouseleave', '.message', md.hideMessageMenus)
		.on('mouseenter', '.user', miaou.userProfile.show);
		$(document.body).on('mouseleave', '.profile', miaou.userProfile.hide)
		.on('mouseleave', '.user', function(e){
			if (!miaou.eventIsOver(e, $('.profile'))) miaou.userProfile.hide();
		});
		$('#users').on('mouseenter', '.user', md.showUserHoverButtons)
		.on('mouseleave', '.user', md.hideUserHoverButtons);
	}
	
	$('#notablemessages, #searchresults').on('click', '.message', function(e){
		md.focusMessage(+$(this).attr('mid'));
		e.stopPropagation();			
	}).on('click', '.opener', md.opener).on('click', '.closer', md.closer);

	if (chat.checkAuth('admin')) $('#editroom').click(function(){ location = 'room?id='+room.id });
	else $('#editroom').hide();
	$('#auths').click(function(){ location = 'auths?id='+room.id });			
			
	$('#showPreview').click(function(){
		$(this).hide();
		$('#input').focus();
		$('#previewpanel').show();
		md.scrollToBottom();
	});
	$('#hidePreview').click(function(){
		$('#input').focus();
		$('#showPreview').show();
		$('#previewpanel').hide();
	});
	$('#input').on('change keyup', function(){
		$('#preview').html(miaou.mdToHtml(this.value, false, me.name));
	});
	
	$('#searchInput').on('keyup', function(e){
		if (e.which===27 && typeof tab === "function") { // escape
			tab("notablemessagespage");
			return false;
		}
		var pat = this.value.trim();
		if (pat) {
			miaou.socket.emit('search', {pattern:pat});
			miaou.hist.search(pat);
		} else {
			$('#searchresults').empty();
			miaou.hist.clearSearch();
		}
	});
	
	// When the window is resized, all the messages have to be resized too.
	$(window).on('resize', md.resizeAll);
	
	// called in case of new message (or a new important event related to a message)
	miaou.touch = function(mid, ping, from, text, r){
		var visible = vis();
		if (ping) {
			if (visible) {
				chat.clearPings();
			} else {
				miaou.notify(r || room, from, text);
				if (mid && !chat.oldestUnseenPing) chat.oldestUnseenPing = mid;
			}
		}
		if (!visible) miaou.updateTab(chat.oldestUnseenPing, ++chat.nbUnseenMessages);
	}
	
	miaou.updateTab = function(hasPing, nbUnseenMessages){
		var title = room.name;
		if (nbUnseenMessages) title = nbUnseenMessages+'-'+title;
		if (hasPing) title = '*'+title;
		document.title = title;
		var e = document.getElementById('favicon');
		if (e) {
			var icon = 'static/M-32';
			if (hasPing) icon += '-ping';
			else if (nbUnseenMessages) icon += '-new';
			e.href = icon+'.png';
		}
	}
	
	editor.init();
}
