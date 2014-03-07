var miaou = miaou || {};

miaou.eventIsOver = function(event, o) {
	if (!o.length) return false;
	var pos = o.offset(), ex = event.pageX, ey = event.pageY;
	return (
		ex>=pos.left
		&& ex<=pos.left+o.width()
		&& ey>=pos.top
		&& ey<pos.top+o.height()
	);
}
// used in chat.jade, chat.mob.jade and auths.jade
miaou.showUserProfile = function(){
	miaou.hideUserProfile();
	miaou.profileTimer = setTimeout((function(){
		var $user = $(this), $message = $user.closest('.message,.notification,.userLine'),
			up = ($message.length ? $message : $user).position(),
			uh = $user.height(), uw = $user.width(),
			$scroller = $user.closest('#messagescroller,#authspage,#left'), ss = $scroller.scrollTop(), sh = $scroller.height(),
			$container = $user.closest('#messages,#authspage,body').first(), ch = $container.height();
		var $p = $('<div>').addClass('profile').text('loading profile...'), css={};
		if (up.top-ss<sh/2) css.top = up.top+1;
		else css.bottom = ch-up.top-uh-3;
		css.left = up.left + uw;
		if (!$message.hasClass('message')) {
			css.left += 10; css.bottom -= 12; // :-(
		}
		$p.css(css).appendTo($container);
		$user.addClass('profiled');
		var userId, data;
		if ((data = $user.data('user') || (data = $message.data('user')))) userId = data.id;
		else userId = $message.data('message').author;
		$p.load('publicProfile?user='+userId+'&room='+room.id);
	}).bind(this), miaou.DELAY_BEFORE_PROFILE_POPUP);
}
miaou.hideUserProfile = function(){
	clearTimeout(miaou.profileTimer);
	$('.profile').remove();
	$('.user').removeClass('profiled');
}
miaou.toggleUserProfile = function(){
	miaou[$('.profile').length ? 'hideUserProfile' : 'showUserProfile'].call(this);
}

miaou.getMessages = function(){
	return $('#messages .message').map(function(){ return $(this).data('message') }).get();
}

miaou.MAX_AGE_FOR_EDIT = 5000; // seconds (should be coherent with server settings)
miaou.DELAY_BEFORE_PROFILE_POPUP = 300; // ms

miaou.chat = function(){
	
	var nbUnseenMessages = 0, oldestUnseenPing = 0, lastReceivedPing = 0,
		DISRUPTION_THRESHOLD = 60*60, // seconds
		voteLevels = [{key:'pin',icon:'&#xe813;'}, {key:'star',icon:'&#xe808;'}, {key:'up',icon:'&#xe800;'}, {key:'down',icon:'&#xe801;'}],
		timeOffset, enterTime, // both in seconds since epoch, server time
		me = window['me'], room = window['room'],
		pingRegex = new RegExp('@'+me.name+'(\\b|$)');
	
	function setEnterTime(serverTime){
		enterTime = serverTime;
		timeOffset = Date.now()/1000 - serverTime;
	}
	
	function permalink(message){
		return location.href.match(/^[^&#]*/) + '#' + message.id;
	}
	
	// returns true if the user's authorization level in room is at least the passed one
	function checkAuth(auth) {
		var levels = ['read', 'write', 'admin', 'own'];
		for (var i=levels.length; i-->0;) {
			if (levels[i]===room.auth) return true;
            if (levels[i]===auth) return false;
		}
        return false;
	}
	
	function formatMoment(m) {
		var now = new Date();
		if (now/1000-m.unix()<15*60) return m.fromNow();
		if (now.getFullYear()===m.year()) {
			if (now.getMonth()===m.month() && now.getDate()===m.date()) {
				return m.format("HH:mm");
			}
			return m.format("D MMMM HH:mm");
		}
		return m.format("D MMMM YYYY HH:mm");
	}

	function isAtBottom(){
		var $scroller = $('#messagescroller'), $messages = $('#messages'),
			lastMessage = $messages.find('.message').last(), pt = parseInt($scroller.css('padding-top'));
		return lastMessage.length && lastMessage.offset().top + lastMessage.height() < $scroller.offset().top + $scroller.height() + pt + 5;
	}
	var scrollToBottom = function(){
		setTimeout(function(){ // because it doesn't always work on Firefox without this 
			$('#messagescroller').scrollTop($('#messagescroller')[0].scrollHeight);
			miaou.hist.showPage();
		},10);
	}

	function showMessageFlowDisruptions(){
		var lastMessage;
		$('#messages .message').removeClass('disrupt').each(function(){
			var $this = $(this), message = $this.data('message');
			if (lastMessage && message.created-lastMessage.created > DISRUPTION_THRESHOLD) $this.addClass('disrupt')
			lastMessage = message;
		});
	}

	function votesAbstract(message){
		return voteLevels.map(function(l){
			return message[l.key] ? '<span class=vote>'+message[l.key]+' '+l.icon+'</span>' : '';
		}).join('');
	}

	// used for notable messages and search results
	function showMessages(messages, $div) {
		$div.empty();
		messages.forEach(function(m){
			var $content = $('<div>').addClass('content').html(miaou.mdToHtml(m.content, false, m.authorname));
			var $md = $('<div>').addClass('message').data('message',m).attr('mid',m.id).append($content).append(
				$('<div>').addClass('nminfo').html(votesAbstract(m) + ' ' + moment((m.created+timeOffset)*1000).format("D MMMM, HH:mm") + ' by ' + m.authorname)
			).appendTo($div)
			if ($content.height()>80) {
				$content.addClass("closed");
				$md.append('<div class=opener>');
			}
		});
	}
	
	function updateNotableMessages(message){
		var $page = $('#notablemessagespage'), isPageHidden = !$page.hasClass('selected');
		if (isPageHidden) $page.addClass('selected'); // so that the height computation of messages is possible 
		var yetPresent = false, notableMessages = $('#notablemessages .message').map(function(){
			var msg = $(this).data('message');
			if (message && msg.id===message.id) {
				yetPresent = true;
				return message;
			}
			return msg;
		}).get();
		if (!yetPresent && message) notableMessages.push(message);
		notableMessages = notableMessages.filter(function(m){ return m.score>4 }).sort(function(a,b){
			return b.score-a.score + (b.created-a.created)/7000
		}).slice(0,12)
		showMessages(notableMessages, $('#notablemessages'));
		$('#notablemessages .message').each(function(){
			var $m = $(this), m = $m.data('message'), age = (Date.now()/1000 - m.created), maxAge = 3*24*60*60;
			if (age<maxAge) {
				$m.addClass('flash');
				setTimeout(function(){ $m.removeClass('flash') }, Math.floor((maxAge-age)*4000/maxAge));
			}
		});
		if (isPageHidden) $page.removeClass('selected');
	}
	
	function updateOlderAndNewerLoaders(){
		$('.olderLoader, .newerLoader').remove();
		$('#messages .message.hasOlder').each(function(){
			$('<div>').addClass('olderLoader').data('mid', this.getAttribute('mid')).text("load older messages").insertBefore(this);
		});
		$('#messages .message.hasNewer').each(function(){
			$('<div>').addClass('newerLoader').data('mid', this.getAttribute('mid')).text("load newer messages").insertAfter(this);
		});		
	}
	
	function showHasOlderThan(messageId){
		$('#messages .message[mid='+messageId+']').addClass('hasOlder');
		updateOlderAndNewerLoaders();
	}
	function showHasNewerThan(messageId){
		$('#messages .message[mid='+messageId+']').addClass('hasNewer');
		updateOlderAndNewerLoaders();
	}
	
	function showError(error){
		$('<div>').addClass('error').append(
			$('<div>').addClass('user error').text("Miaou Server")
		).append(
			$('<div>').addClass('content').text(typeof error === "string" ? error : "an error occured - connexion might be damaged")
		).appendTo('#messages');
		scrollToBottom();
	}
	
	function showRequestAccess(ar){
		var h, wab = isAtBottom();
		if (!ar.answered) h = "<span class=user>"+ar.user.name+"</span> requests access to the room.";
		else if (ar.outcome) h = "<span class=user>"+ar.user.name+"</span> has been given "+ar.outcome+" right.";
		else h = "<span class=user>"+ar.user.name+"</span> has been denied entry by <span class=user>"+ar.answerer.name+"</span>.";
		var $md = $('<div>').html(h).addClass('notification').data('user', ar.user).appendTo('#messages');
		$md.append($('<button>').addClass('remover').text('X').click(function(){ $md.remove() }));
		if (checkAuth('admin')) {
			$('<button>').text('Manage Users').click(function(){ $('#auths').click() }).appendTo($md);
			if (!vis()) {
				document.title = (oldestUnseenPing?'*':'') + ++nbUnseenMessages + ' - ' + room.name;				
			}
		}
		if (wab) scrollToBottom();
	}

	function addMessage(message){
		var messages = miaou.getMessages(), insertionIndex = messages.length; // -1 : insert at begining, i>=0 : insert after i
		var wasAtBottom = isAtBottom();
		if (messages.length===0 || message.id<messages[0].id) {
			insertionIndex = -1;
		} else {
			while (insertionIndex && messages[--insertionIndex].id>message.id){};
		}
		var $md = $('<div>').addClass('message').data('message', message).attr('mid', message.id),
			$user = $('<div>').addClass('user').text(message.authorname).appendTo($md),
			$content = $('<div>').addClass('content').append(miaou.mdToHtml(message.content, true, message.authorname)).appendTo($md);
		if (message.authorname===me.name) {
			$md.addClass('me');
			$('.error').remove();
		}
		if (message.changed) $md.addClass('edited');
		if (~insertionIndex) {
			if (messages[insertionIndex].id===message.id) {
				if (message.vote==='?') {
					message.vote = messages[insertionIndex].vote;
				}
				$('#messages .message').eq(insertionIndex).replaceWith($md);
			} else {
				$('#messages .message').eq(insertionIndex).after($md);				
			}
		} else {
			$md.prependTo('#messages');
		}
		var resize = function(){
			var h = $content.height();
			if ($content.height()>138) {
				$md.find('.opener').remove();
				$content.addClass("closed");
				h = $content.height()
				$md.append('<div class=opener>');
			}
			$user.height(h).css('line-height',h+'px');
			if (wasAtBottom) scrollToBottom();
			else miaou.hist.showPage();
		}
		resize();
		$content.find('img').load(resize);
		topUserList({id: message.author, name: message.authorname});
		
		var votesHtml = votesAbstract(message);
		if (votesHtml.length) $md.append($('<div/>').addClass('messagevotes').html(votesHtml));
		showMessageFlowDisruptions();
		updateOlderAndNewerLoaders();
		if (wasAtBottom && message.id==$('#messages .message').last().attr('mid')) scrollToBottom();
	}
	
	
	function $user(user){
		return $('#users .user').filter(function(){ return $(this).data('user').id===user.id });
	}
	// put the user at the top of the list
	function topUserList(user) {
		var $u = $user(user);
		($u.length ? $u :$('<span class=user/>').text(user.name).data('user',user)).prependTo('#users');
	}
	function showEntry(user){
		topUserList(user);
		$user(user).addClass('connected');
	}
	function showLeave(user){
		$user(user).removeClass('connected');		
	}
	
	function opener(e){
		$(this).removeClass('opener').addClass('closer').closest('.message').find('.content').removeClass('closed');
		e.stopPropagation();
	}
	function closer(e){
		$(this).removeClass('closer').addClass('opener').closest('.message').find('.content').addClass('closed');
		e.stopPropagation();			
	}
	
	function showMessageMenus(){
		hideMessageMenus();
		var $message = $(this), message = $message.data('message'), infos = [],
		created = message.created+timeOffset, m = moment(created*1000);
		if (message.author===me.id) {
			if (Date.now()/1000 - created < miaou.MAX_AGE_FOR_EDIT) $('<button>').addClass('editButton').text('edit').appendTo($message.find('.user'));
			else infos.push('too old for edition');
		} else {
			$('<button>').addClass('replyButton').text('reply').appendTo($message.find('.user'));
		}
		infos.push(formatMoment(m));
		$('<div>').addClass('messagemenu').html(
			infos.map(function(txt){ return '<span class=txt>'+txt+'</span>' }).join(' - ') + ' ' +
			'<a class=link target=_blank href="'+permalink(message)+'" title="permalink : right-click to copy">&#xe815;</a> ' + 
			voteLevels.slice(0, message.author===me.id ? 1 : 4).slice(checkAuth('admin')?0:1).map(function(l){
				return '<span class="vote'+(l.key===message.vote?' on':'')+'" vote-level='+l.key+' title="'+l.key+'">'+l.icon+'</span>'
			}).join('')
		).appendTo(this);
	}
	function hideMessageMenus(){
		$('.messagemenu, .editButton, .replyButton').remove();
	}
	function toggleMessageMenus(){
		($('.messagemenu, .editButton, .replyButton', this).length ? hideMessageMenus : showMessageMenus).call(this);
	}
	
	function showUserHoverButtons(){
		var user = $(this).data('user');
		if (user.name===me.name) return;
		$('<button>').addClass('pingButton').text('ping').click(function(){
			miaou.editor.ping(user.name);
		}).appendTo(this);
		$('<button>').addClass('pmButton').text('pm').click(function(){
			var win = window.open();
			miaou.socket.emit('pm', user.id, function(roomId){
				win.location = roomId;
				//win.focus();
			});			
		}).appendTo(this);
	}
	function hideUserHoverButtons(){
		$('.pingButton,.pmButton').remove();
	}
	
	$(function(){
		var socket = miaou.socket = io.connect(location.origin);

		function clearPings() {
			// clear the pings of the current room and ask for the ones of the other rooms
			socket.emit('clear_pings', lastReceivedPing, function(pings){
				if (pings.length) {
					pings.forEach(function(p){
						oldestUnseenPing = Math.min(oldestUnseenPing, p.first);
						lastReceivedPing = Math.max(lastReceivedPing, p.last);
					});
					var h = "You've been pinged in room";
					if (pings.length>1) h += 's';
					var $md = $('<div>').html(h).addClass('notification').appendTo('#messages');
					pings.forEach(function(p){
						$md.append($('<button>').addClass('openroom').text(p.roomname).click(function(){
							window.open(p.room);
							if ($md.find('.openroom').length==1) $md.remove();
							else $(this).remove();
						}))
					});
					$md.append($('<button>').addClass('remover').text('X').click(function(){ $md.remove() }));
					scrollToBottom();
				}
			});
		}

		vis(function(){
			if (vis()) {
				clearPings();
				nbUnseenMessages = 0;
				if (oldestUnseenPing) {
					miaou.focusMessage(oldestUnseenPing);
					oldestUnseenPing = 0;
				}
				document.title = room.name;
			}
		});
		
		function goToMessageDiv(messageId){
			var $messages = $('#messagescroller'),
				$message = $('.message', $messages).filter(function(){ return $(this).data('message').id==messageId }).addClass('goingto');
			setTimeout(function(){
				var mtop = $message.offset().top;
				if (mtop<0 || mtop>$messages.height()) $messages.animate({scrollTop: mtop+$messages.scrollTop()-25}, 400);
				setTimeout(function(){ $message.removeClass('goingto'); }, 3000);
				miaou.hist.showPage();
			}, 300);
		}

		// ensures the messages and the messages around it are loaded,
		//  and then scroll to it and flashes it
		miaou.focusMessage = function(messageId){
			var $messages = $('#messages .message'), l = $messages.length,
				beforeId = 0, afterId = 0, mids = new Array($messages.length);
			for (var i=0; i<l; i++) {
				mids[i] = +$messages.eq(i).attr('mid');
				if (mids[i]===messageId) return goToMessageDiv(messageId);
			} 
			for (var i=0; i<l; i++) {
				if (mids[i]<messageId) beforeId=mids[i];
				else break;
			}
			for (var i=l; i-->0;) {
				if (mids[i]>messageId) afterId=mids[i];
				else break;
			}
			socket.emit('get_around', { target:messageId, olderPresent:beforeId, newerPresent:afterId }, function(){
				goToMessageDiv(messageId);
			});
		}

		setInterval(function(){
			if (vis()) clearPings();
		}, 3*60*1000);
		
		
		socket.on('ready', function(){			
			socket.emit('enter', room.id, setEnterTime);
		}).on('get_room', function(unhandledMessage){
			socket.emit('enter', room.id, setEnterTime);
			socket.emit('message', unhandledMessage);
		}).on('message', function(message){
			//~ console.log('received:', message);
			addMessage(message);
			updateNotableMessages(message);
			if (message.created>enterTime) {
				var visible = vis(), ping = pingRegex.test(message.content);
				if (ping) {
					if (visible) {
						clearPings();
					} else {
						miaou.notify(room, message.authorname, message.content);
						if (!oldestUnseenPing) oldestUnseenPing = message.id;
					}
				}
				if (!visible) document.title = (oldestUnseenPing?'*':'') + ++nbUnseenMessages + ' - ' + room.name;
			}
		}).on('room', function(r){
			if (room.id!==r.id) {
				console.log('SHOULD NOT HAPPEN!');
			}
			room = r;
			localStorage['successfulLoginLastTime'] = "yes";
			localStorage['room'] = room.id;
			document.title = room.name;
			$('#roomname').text(room.name);
			$('#roomdescription').html(miaou.mdToHtml(room.description));
		}).on('notable_message', updateNotableMessages)
		.on('has_older', showHasOlderThan).on('has_newer', showHasNewerThan)
		.on('request', function(ar){
			showRequestAccess(ar);
		}).on('reconnect', function(){
			console.log('RECONNECT, sending room again');
			setTimeout(function(){
				socket.emit('enter', room.id, setEnterTime);
			}, 500); // first message after reconnect not always received by server if I don't delay it (todo : elucidate and clean)
		}).on('welcome', function(){
			if (location.hash) miaou.focusMessage(+location.hash.slice(1));
			else scrollToBottom();
			showEntry(me);
		}).on('invitation', function(invit){
			$('<div>').html(
				'You have been invited by <span class=user>'+invit.byname+'</span> in a private lounge.'
			).addClass('notification').append(
				$('<button>').addClass('openroom').text('Enter room').click(function(){
					window.open(invit.room);
					$(this).closest('.notification').remove();
				})
			).append(
				$('<button>').addClass('remover').text('X').click(function(){ $md.remove() })
			).appendTo('#messages');
			scrollToBottom();
		}).on('disconnect', function(){
			console.log('DISCONNECT');
		}).on('enter', showEntry).on('leave', showLeave).on('error', showError);
		
		
		$('#messages').on('click', '.message .content img', function(e){
			window.open(this.src);
			e.stopPropagation();
		}).on('click', '.message .content a[href]', function(){
			var parts = this.href.match(/^([^?#]+\/)(\d+)(\?[^#?]*)?#?(\d+)?$/);
			if (parts && parts.length===5 && parts[1]===(location.origin+location.pathname).match(/(.*\/)[^\/]*$/)[1]) {
				// it's an url towards a room or message on this server
				if (room.id===+parts[2]) {
					// it's an url for the same room
					if (parts[4]) {
						// it's an url for a message
						miaou.focusMessage(+parts[4]);
					} else {
						// it's just an url to our room. Let's... err... scroll to bottom ?
						scrollToBottom();
					}
					return false;
				} else {
					// it's an url for another room or for a message in another room, let's go to the right tab if it's already open
					//  or open it if not
					this.target = 'room_'+parts[2];
					var h = parts[1]+parts[2];
					if (parts[3].indexOf('=')===-1) h += parts[3].slice('&')[0];
					h += h.indexOf('?')===-1 ? '?' : '&';
					h += 't='+Date.now();
					if (parts[4]) h += '#'+parts[4];
					this.href = h;
				}
			}
		}).on('click', '.opener', opener).on('click', '.closer', closer)
		.on('click', '.editButton', function(){
			miaou.editor.editMessage($(this).closest('.message').data('message'));
		}).on('click', '.replyButton', function(){
			miaou.editor.replyToMessage($(this).closest('.message').data('message'));
		}).on('mouseenter', '.reply', function(e){
			var mid = $(this).attr('to');
			$('#messages .message').filter(function(){ return $(this).data('message').id==mid }).addClass('target');
			e.stopPropagation();
		}).on('mouseleave', '.reply', function(){
			$('.target').removeClass('target');
		}).on('click', '.reply', function(e){
			miaou.focusMessage(+$(this).attr('to'));
			e.stopPropagation();			
		}).on('click', 'a', function(e){
			e.stopPropagation();
		}).on('click', '.vote', function(){
			var $e = $(this), message = $e.closest('.message').data('message'), vote = $e.attr('vote-level');
			if (message.vote) socket.emit('vote', {action:'remove',  message:message.id, level:message.vote});
			if (message.vote!=vote) socket.emit('vote', {action:'add',  message:message.id, level:vote});
			return false;
		}).on('click', '.olderLoader', function(){
			var $this = $(this), mid = +$this.data('mid'), olderPresent = 0;
			$this.remove();
			$('.hasOlder[mid='+mid+']').removeClass('hasOlder');
			miaou.getMessages().forEach(function(m){ if (m.id<mid) olderPresent=m.id });
			socket.emit('get_older', {before:mid, olderPresent:olderPresent});
		}).on('click', '.newerLoader', function(){
			var $this = $(this), mid = +$this.data('mid'), newerPresent = 0;
			$this.remove();
			miaou.getMessages().reverse().forEach(function(m){ if (m.id>mid) newerPresent=m.id });
			$('.hasOlder[mid='+mid+']').removeClass('hasNewer');
			socket.emit('get_newer', {after:mid, newerPresent:newerPresent});
		});
		
		if ($('#hist').length) {
			$('#messagescroller').on('scroll', miaou.hist.showPage);
		}
		
		if ($(document.body).hasClass('mobile')) {
			$('#messages').on('click', '.message', toggleMessageMenus)
			.on('click', '.user,.profile', miaou.toggleUserProfile);
			$(window).resize(scrollToBottom);
		} else {
			$('#messages,#users')
			.on('mouseenter', '.message', showMessageMenus).on('mouseleave', '.message', hideMessageMenus)
			.on('mouseenter', '.user', miaou.showUserProfile);
			$(document.body).on('mouseleave', '.profile', miaou.hideUserProfile)
			.on('mouseleave', '.user', function(e){
				if (!miaou.eventIsOver(e, $('.profile'))) miaou.hideUserProfile();
			});
			$('#users').on('mouseenter', '.user', showUserHoverButtons)
			.on('mouseleave', '.user', hideUserHoverButtons);
		}
		
		$('#notablemessages, #searchresults').on('click', '.message', function(e){
			miaou.focusMessage(+$(this).attr('mid'));
			e.stopPropagation();			
		}).on('click', '.opener', opener).on('click', '.closer', closer);

		miaou.editor.init(socket);
		if (checkAuth('admin')) $('#editroom').click(function(){ location = 'room?id='+room.id });
		else $('#editroom').hide();
		$('#auths').click(function(){ location = 'auths?id='+room.id });			
				
		$('#showPreview').click(function(){
			$(this).hide();
			$('#input').focus();
			$('#previewpanel').show();
			scrollToBottom();
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
			if (e.which===27) $(this).val('');
			var pat = this.value.trim();
			if (pat) {
				socket.emit('search', {pattern:pat}, function(results){
					showMessages(results, $('#searchresults'));
				});
				miaou.hist.search(pat);
			} else {
				$('#searchresults').empty();
				miaou.hist.clearSearch();
			}
		});

		console.log('Miaou!');
	});
};
