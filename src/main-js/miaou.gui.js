
miaou(function(gui, chat, ed, hist, locals, md, mh, ms, notif, horn, prof, usr, win, ws, wz){

	var $scroller = gui.$messageScroller = $('#message-scroller');
	var scroller = $scroller[0];
	gui.$messageScroller = $scroller;
	gui.mobile = document.body.classList.contains('mobile');
	var scrollerPaddingTop = parseInt($scroller.css('padding-top'));

	gui.currentDownKey = undefined;
	$(document)
	.keydown(e=>{
		gui.currentDownKey = e.which;
	})
	.keyup(e=>{
		gui.currentDownKey = undefined;
	});

	gui.isAtBottom = function(){
		var messages = document.getElementById("messages");
		if (!messages) return false;
		var lm = messages.lastChild; // last user message element
		if (!lm) return false;
		var messagesBottom = $scroller.offset().top + scroller.offsetHeight + scrollerPaddingTop + 5;
		return $(lm).offset().top + lm.offsetHeight < 	messagesBottom;
	}

	function _scrollToBottom(){
		$scroller.scrollTop(scroller.scrollHeight);
	}

	gui.scrollToBottom = function($m){
		_scrollToBottom();
		if ($m && $m.find) { // FIXME : cleaner API
			$m.find('img').imgOn('load', _scrollToBottom);
		}
	}

	gui.setRoom = function(r){
		locals.room = r;
		localStorage['successfulLoginLastTime'] = "yes";
		localStorage['room'] = locals.room.id;
		notif.updateTab(0, 0);
		$('#roomname').text(locals.room.name);
		var htmldesc = miaou.fmt.mdTextToHtml(
			locals.room.description.trim()||"*no description*",
			null,
			true
		);
		$('#room-description').html(htmldesc);
		$("#room-tags").empty().append(locals.room.tags.map(function(t){
			return $("<span class=tag>").text(t);
		}));
		$('#room-panel-bg, #room-area')
		.toggleClass("has-background-image", !!locals.room.img)
		.css('background-image', locals.room.img ? 'url("'+locals.room.img+'")' : 'none');
	}

	gui.init = function(){
		var	timer;

		$('#messages')
		.on('click', '.message .content img', function(e){
			var w = window.open();
			w.opener = null;
			w.location = this.getAttribute('href')||this.src;
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
			var message = $(this).closest('.message').dat('message');
			ms.updateStatus(message);
			var ismoddelete = !message.status.deletable && message.status.mod_deletable;
			var $content = $('<div>').append(
				$('<p>').text('Do you want to delete this message ?')
			).append(
				$('<p>').addClass('rendered').html(miaou.fmt.mdTextToHtml(message.content||''))
			).append(
				$('<p>').text("This can't be undone.")
			);

			if (ismoddelete) {
				$('<p>').addClass('warning')
				.text("Warning: you're about to delete another user's message")
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
		.on('click', '.replyButton,.continueButton', function(){
			var	$m = $(this).closest('.message');
			notif.userAct($m.dat('message').id);
			ed.replyToMessage($m);
			return false;
		})
		.on('click', '.reply', function(e){
			var	$m = $(this).closest('.message');
			notif.userAct($m.dat('message').id);
			md.focusMessage(+$(this).attr('to'));
			e.stopPropagation();
		})
		.on('click', '.vote', function(){
			var	$e = $(this),
				message = $e.closest('.message').dat('message'),
				vote = $e.attr('vote-level'),
				o = { mid:message.id};
			if (message.vote) o.remove = message.vote;
			if (message.vote!=vote) o.add = vote;
			md.applyVote(o);
			ws.emit('vote', o);
			notif.userAct(message.id);
			return false;
		})
		.on('click', '.unpin', function(){
			var m = $(this).closest('.message').dat('message');
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
			var $e = $(this), message = $e.closest('.message').dat('message');
			win.add(message);
			notif.userAct(message.id);
			return false;
		})
		.on('click', '.copysrc', function(){
			var $e = $(this), message = $e.closest('.message').dat('message');
			var ta = document.createElement("textarea");
			ta.value = message.content || "";
			document.body.appendChild(ta);
			ta.select();
			document.execCommand("copy");
			document.body.removeChild(ta);
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
		.on('click', '.ping', function(){
			window.open('user/'+this.textContent.trim().slice(1));
			return false;
		})
		.on('click', '.pen', function(){
			var m = $(this).closest('.message').dat('message');
			mh.show(m);
			notif.userAct(m.id);
			return false;
		});

		if ($('#hist').length) {
			gui.$messageScroller.on('scroll', hist.showPage);
		}

		if (gui.mobile) {
			$('#messages')
			.on('click', '.message', md.toggleMessageHoverInfos)
			.on('click', '.user,.profile', prof.toggle);
		} else {
			$('#messages')
			.on('mouseenter', '.message', wz.onmouseenter)
			.on('mouseleave', '.message', wz.onmouseleave)
			.on('mouseenter', '.continueButton,.replyButton,.deleteButton,.editButton', function(){
				$(document.body).addClass("buttons-hovered");
			})
			.on('mouseleave', '.continueButton,.replyButton,.deleteButton,.editButton', function(){
				$(".buttons-hovered").removeClass("buttons-hovered");
			});
			$('#messages, #notifications')
			.on('mouseenter', '.message', md.showMessageHoverInfos)
			.on('mouseleave', md.hideMessageHoverInfos)
			.on('mouseenter', '.decorations', prof.show)
			.on('mouseenter', '.decorations', md.hideNotHoveredMessageInfos);
			$(document.body)
			.on('mouseleave', '.profile', prof.hide)
			.on('mouseleave', '.user', prof.checkOverProfile);
			$('#users')
			.on('mouseenter', '.user', usr.showUserHoverButtons)
			.on('mouseleave', '.user', usr.hideUserHoverButtons)
			.on('mouseenter', '.user', prof.show);
			// When the window is resized, all the messages have to be resized too.
			$(window).on('resize', md.resizeAll);
		}

		$('#notable-messages, #search-results')
		.on('click', '.message', function(e){
			var $this = $(this);
			$this.closest('#notable-messages, #search-results').find('.message.selected').removeClass('selected');
			md.focusMessage(+$this.addClass('selected').attr('mid'));
			e.stopPropagation();
			if ($this.closest('#notable-messages').length) {
				clearTimeout(timer);
				timer = setTimeout(function(){ $this.removeClass('selected') }, 2000);
			} else {
				$('#search-input').focus();
			}
		})
		.on('click', '.opener', md.opener)
		.on('click', '.closer', md.closer);

		if (usr.checkAuth('admin')) $('#room-edit').click(function(){ location = 'room?id='+locals.room.id });
		else $('#room-edit').hide();
		$('#auths').click(function(){ location = 'auths?id='+locals.room.id });

		$('#showPreview').click(function(){
			$(this).hide();
			$('#input').focus();
			$('#preview').show();
			$('#hidePreview').show();
			gui.scrollToBottom();
			return false;
		});
		$('#hidePreview').click(function(){
			$(this).hide();
			$('#input').focus();
			$('#showPreview').show();
			$('#preview').hide();
			return false;
		});
		$('#input').on('change keyup', function(){
			$('#preview').html(miaou.fmt.mdTextToHtml(this.value, locals.me.name));
		});

		ed.init();
	}
});
