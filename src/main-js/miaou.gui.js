
miaou(function(gui, chat, ed, hist, locals, md, mh, ms, notif, horn, prof, usr, win, ws, wz){
		
	gui.mobile = $(document.body).hasClass('mobile');
	
	gui.isAtBottom = function(){
		var $scroller = $('#message-scroller'), $messages = $('#messages'),
			lastMessage = $messages.find('.message').last(), pt = parseInt($scroller.css('padding-top'));
		return lastMessage.length && lastMessage.offset().top + lastMessage.height() < $scroller.offset().top + $scroller.height() + pt + 5;
	}

	function _scrollToBottom(){
		var scroller = document.getElementById('message-scroller');
		$(scroller).scrollTop(scroller.scrollHeight);
	}

	gui.scrollToBottom = function($m){
		_scrollToBottom();
		if ($m && $m.find) { // FIXME : cleaner API
			$m.find('img').load(function(){ console.log('img load'); _scrollToBottom() });
		}
	}
	
	gui.init = function(){
		var	timer;
					
		$('#messages').on('click', '.message .content img', function(e){
			window.open(this.getAttribute('href')||this.src);
			e.stopPropagation();
		})
		.on('click', '.opener', md.opener)
		.on('click', '.closer', md.closer)
		.on('click', '.editButton', function(){
			prof.hide();
			ed.editMessage($(this).closest('.message'));
			return false;
		})
		.on('click', '.deleteButton', function(){
			prof.hide();
			var message = $(this).closest('.message').data('message');
			ms.updateStatus(message);
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
						if (ismoddelete) ws.emit('mod_delete', [message.id]);
						else ws.emit('message', {id:message.id, content:''});
					}
				}
			});
			notif.userAct(message.id);
			return false;
		})
		.on('click', '.replyButton', function(){
			var	$m = $(this).closest('.message');
			notif.userAct($m.data('message').id);
			ed.replyToMessage($m);
			return false;
		})
		.on('mouseenter', '.replyButton,.deleteButton,.editButton', prof.hide)
		.on('mouseleave', '.replyButton,.deleteButton,.editButton', prof.shownow)
		.on('mouseenter', '.message', wz.onmouseenter)
		.on('mouseleave', '.message', wz.onmouseleave)
		.on('click', '.reply', function(e){
			var	$m = $(this).closest('.message');
			notif.userAct($m.data('message').id);
			md.focusMessage(+$(this).attr('to'));
			e.stopPropagation();		
		})
		.on('click', '.vote', function(){
			var $e = $(this), message = $e.closest('.message').data('message'), vote = $e.attr('vote-level');
			if (message.vote) ws.emit('vote', {action:'remove', mid:message.id, level:message.vote});
			if (message.vote!=vote) ws.emit('vote', {action:'add', mid:message.id, level:vote});
			notif.userAct(message.id);
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
						ws.emit('unpin', m.id);
					}
				}
			});
			notif.userAct(m.id);
			return false;
		})
		.on('click', '.makemwin', function(){
			var $e = $(this), message = $e.closest('.message').data('message');
			win.add(message);
			notif.userAct(message.id);
			return false;
		})	
		.on('click', '.olderLoader', function(){
			var $this = $(this), mid = +$this.attr('mid'), olderPresent = 0;
			$this.remove();
			md.getMessages().forEach(function(m){ if (m.id<mid) olderPresent=m.id });
			ws.emit('get_older', {from:mid, until:olderPresent});
			return false;
		})
		.on('click', '.newerLoader', function(){
			var $this = $(this), mid = +$this.attr('mid'), newerPresent = 0;
			$this.remove();
			md.getMessages().reverse().forEach(function(m){ if (m.id>mid) newerPresent=m.id });
			ws.emit('get_newer', {from:mid, until:newerPresent});
			return false;
		})
		.on('click', '.pen', function(){
			var m = $(this).closest('.message').data('message');
			mh.show(m);
			notif.userAct(m.id);
			return false;
		});
		
		if ($('#hist').length) {
			$('#message-scroller').on('scroll', hist.showPage);
		}
		
		if (gui.mobile) {
			$('#messages')
			.on('click', '.message', md.toggleMessageHoverInfos)
			.on('click', '.user,.profile', prof.toggle);
			$(window).resize(gui.scrollToBottom);
		} else {
			$('#messages, #users, #notifications')
			.on('mouseenter', '.message', md.showMessageHoverInfos)
			.on('mouseleave', '.message', md.hideMessageHoverInfos)
			.on('mouseenter', '.user', prof.show);
			$(document.body)
			.on('mouseleave', '.profile', prof.hide)
			.on('mouseleave', '.user', prof.checkOverProfile);
			$('#users')
			.on('mouseenter', '.user', usr.showUserHoverButtons)
			.on('mouseleave', '.user', usr.hideUserHoverButtons);
		}
		
		$('#notable-messages, #search-results').on('click', '.message', function(e){
			var $this = $(this);
			$this.closest('#notable-messages, #search-results').find('.message.selected').removeClass('selected');
			md.focusMessage(+$this.addClass('selected').attr('mid'));
			e.stopPropagation();
			if ($this.closest('#notable-messages').length) {
				clearTimeout(timer);
				timer = setTimeout(function(){ $this.removeClass('selected') }, 2000);
			} else {
				$('#searchInput').focus();
			}
		}).on('click', '.opener', md.opener).on('click', '.closer', md.closer);

		if (usr.checkAuth('admin')) $('#editroom').click(function(){ location = 'room?id='+locals.room.id });
		else $('#editroom').hide();
		$('#auths').click(function(){ location = 'auths?id='+locals.room.id });			
				
		$('#showPreview').click(function(){
			$(this).hide();
			$('#input').focus();
			$('#preview-panel').show();
			gui.scrollToBottom();
			return false;
		});
		$('#hidePreview').click(function(){
			$('#input').focus();
			$('#showPreview').show();
			$('#preview-panel').hide();
			return false;
		});
		$('#input').on('change keyup', function(){
			$('#preview').html(miaou.mdToHtml(this.value, false, locals.me.name));
		});
			
		// When the window is resized, all the messages have to be resized too.
		$(window).on('resize', md.resizeAll);
				
		ed.init();
	}
});
