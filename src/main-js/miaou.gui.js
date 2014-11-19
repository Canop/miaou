
miaou(function(gui, chat, ed, hist, md, mh, ms, notif, prof, usr, win, ws, wz){
	
	gui.mobile = $(document.body).hasClass('mobile');
	
	// returns true if an event is over an element
	gui.eventIsOver = function(event, o) {
		if (!o.length) return false;
		var pos = o.offset(), ex = event.pageX, ey = event.pageY;
		return (
			ex>=pos.left
			&& ex<=pos.left+o.width()
			&& ey>=pos.top
			&& ey<pos.top+o.height()
		);
	}
	
	gui.init = function(){
		var	timer,
			lastUserAction; // ms
		
		$('#messages, #notable-messages, #search-results').on('click', '.message .content a[href]', function(e){
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
			window.open(this.getAttribute('href')||this.src);
			e.stopPropagation();
		})
		.on('click', '.opener', md.opener)
		.on('click', '.closer', md.closer)
		.on('click', '.editButton', function(){
			prof.hide();
			ed.editMessage($(this).closest('.message'));
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
		})
		.on('click', '.replyButton', function(){
			ed.replyToMessage($(this).closest('.message'));
		})
		.on('mouseenter', '.replyButton,.deleteButton,.editButton', prof.hide)
		.on('mouseleave', '.replyButton,.deleteButton,.editButton', prof.shownow)
		.on('mouseenter', '.message', wz.onmouseenter)
		.on('mouseleave', '.message', wz.onmouseleave)
		.on('click', '.reply', function(e){
			md.focusMessage(+$(this).attr('to'));
			e.stopPropagation();			
		})
		.on('click', '.vote', function(){
			var $e = $(this), message = $e.closest('.message').data('message'), vote = $e.attr('vote-level');
			if (message.vote) ws.emit('vote', {action:'remove',  message:message.id, level:message.vote});
			if (message.vote!=vote) ws.emit('vote', {action:'add',  message:message.id, level:vote});
			gui.userAct();
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
			return false;
		})
		.on('click', '.makemwin', function(){
			var $e = $(this), message = $e.closest('.message').data('message');
			win.add(message);
			return false;
		})	
		.on('click', '.olderLoader', function(){
			var $this = $(this), mid = +$this.attr('mid'), olderPresent = 0;
			$this.remove();
			md.getMessages().forEach(function(m){ if (m.id<mid) olderPresent=m.id });
			ws.emit('get_older', {from:mid, until:olderPresent});
		})
		.on('click', '.newerLoader', function(){
			var $this = $(this), mid = +$this.attr('mid'), newerPresent = 0;
			$this.remove();
			md.getMessages().reverse().forEach(function(m){ if (m.id>mid) newerPresent=m.id });
			ws.emit('get_newer', {from:mid, until:newerPresent});
		})
		.on('click', '.pen', function(){
			mh.show($(this).closest('.message').data('message'));
		});
		
		if ($('#hist').length) {
			$('#message-scroller').on('scroll', hist.showPage);
		}
		
		if (gui.mobile) {
			$('#messages').on('click', '.message', md.toggleMessageMenus)
			.on('click', '.user,.profile', prof.toggle);
			$(window).resize(md.scrollToBottom);
		} else {
			$('#messages,#users')
			.on('mouseenter', '.message', md.showMessageMenus).on('mouseleave', '.message', md.hideMessageMenus)
			.on('mouseenter', '.user', prof.show);
			$(document.body).on('mouseleave', '.profile', prof.hide)
			.on('mouseleave', '.user', function(e){
				if (!gui.eventIsOver(e, $('.profile'))) prof.hide();
			});
			$('#users').on('mouseenter', '.user', usr.showUserHoverButtons)
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

		if (usr.checkAuth('admin')) $('#editroom').click(function(){ location = 'room?id='+room.id });
		else $('#editroom').hide();
		$('#auths').click(function(){ location = 'auths?id='+room.id });			
				
		$('#showPreview').click(function(){
			$(this).hide();
			$('#input').focus();
			$('#preview-panel').show();
			md.scrollToBottom();
		});
		$('#hidePreview').click(function(){
			$('#input').focus();
			$('#showPreview').show();
			$('#preview-panel').hide();
		});
		$('#input').on('change keyup', function(){
			$('#preview').html(miaou.mdToHtml(this.value, false, me.name));
		});
			
		// When the window is resized, all the messages have to be resized too.
		$(window).on('resize', md.resizeAll);
		
		// called in case of user action proving he's right in front of the chat so
		//  we should not ping him
		gui.userAct = function(){
			lastUserAction = Date.now();
		}
		
		// called in case of new message (or a new important event related to a message)
		gui.touch = function(mid, ping, from, text, r){
			var visible = vis();
			if (ping) {
				if (visible) {
					chat.clearPings();
				} else {
					if (mid && !chat.oldestUnseenPing) chat.oldestUnseenPing = mid;
				}
			}
			if (!visible || userPrefs.nifvis==="yes") {
				if (
					userPrefs.notif==="on_message"
					|| (ping && userPrefs.notif==="on_ping" && Date.now()-lastUserAction>1500)
				) {
					notif.show(r || room, from, text);					
				}
			}
			if (!visible && mid) gui.updateTab(chat.oldestUnseenPing, ++chat.nbUnseenMessages);
		}

		gui.updateTab = function(hasPing, nbUnseenMessages){
			var title = room.name,
				icon = 'static/M-32';
			if (hasPing) {
				title = '*'+title;
				icon += '-ping';
			} else if (nbUnseenMessages) {
				title = nbUnseenMessages+'-'+title;
				icon += '-new';
			}
			document.title = title;
			$('#favicon').attr('href', icon+'.png');
		}
		
		ed.init();
	}
});
