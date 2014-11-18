// md is short for "message display"
// Here are functions related to the display of messages in the chat and to the various message element lists

miaou(function(md, chat, gui, hist, ms, usr, ws){
	var renderers = [], unrenderers = [],
		voteLevels = [{key:'pin',icon:'&#xe813;'}, {key:'star',icon:'&#xe808;'}, {key:'up',icon:'&#xe800;'}, {key:'down',icon:'&#xe801;'}];
	
	// registers a function which will be called when a message needs rendering
	// Unless a renderer returns true, the other renderers will be called.
	// A renderer can be registered to be executed before the standard,markdown
	//  based, renderer, or after : set postrendering to true to register the
	//  renderer as a postrenderer (your renderer would then be able to use the
	//  result of the previous renderers including the default one. 
	// If a renderer has nothing specific to do, it should do nothing and return
	//  undefined.
	// Arguments passed to your renderer are
	//  - $c : the div in which to render the message
	//  - the message
	//  - the previous version of the message if it's a replacement
	// If it's a re-rendering (message was edited, or voted, etc.) the $c div
	//  may be already rendered, even for the first renderer.
	// $c is already added to the dom, which means it's possible to test the
	//  parents if the rendering depends on it
	md.registerRenderer = function(fun, postrendering){
		renderers[postrendering?'push':'unshift'](fun);
	}
	md.registerUnrenderer = function(fun){
		unrenderers.unshift(fun);
	}
	md.render = function($content, message, oldMessage){
		for (var i=0; i<renderers.length; i++) {
			if (renderers[i]($content, message, oldMessage)) break;
		}
	}
	md.unrender = function($content, message){
		for (var i=0; i<unrenderers.length; i++) {
			if (unrenderers[i]($content, message)) break;
		}
	}

	function votesAbstract(message){
		return voteLevels.map(function(l){
			return message[l.key] ? '<span class="vote '+l.key+'">'+message[l.key]+' '+l.icon+'</span>' : '';
		}).join('');
	}

	var isAtBottom = md.isAtBottom = function(){
		var $scroller = $('#message-scroller'), $messages = $('#messages'),
			lastMessage = $messages.find('.message').last(), pt = parseInt($scroller.css('padding-top'));
		return lastMessage.length && lastMessage.offset().top + lastMessage.height() < $scroller.offset().top + $scroller.height() + pt + 5;
	}

	md.scrollToBottom = function(){
		setTimeout(function(scroller){ // because it doesn't always work on Firefox without this 
			$(scroller).scrollTop(scroller.scrollHeight);
			hist.showPage();
		}, 10, document.getElementById('message-scroller'));
	}

	md.getMessages = function(){
		return $('#messages > .message').map(function(){ return $(this).data('message') }).get();
	}

	md.getMessage = function(mid){
		var $message = $('#messages > .message[mid='+mid+']');
		if ($message.length) return $message.eq(0).data('message');
	}

	md.permalink = function(message){
		return location.href.match(/^[^&#]*/) + '#' + message.id;
	}

	// used for notable messages and search results
	md.showMessages = function(messages, $div) {
		$div.empty();
		messages.forEach(function(m){
			if (!m.content) return;
			var $content = $('<div>').addClass('content');
			var $md = $('<div>').addClass('message').data('message',m).append($content).append(
				$('<div>').addClass('nminfo').html(votesAbstract(m) + ' ' + miaou.formatDate((m.created+chat.timeOffset)*1000) + ' by ' + m.authorname)
			).appendTo($div);
			if (m.id) $md.attr('mid',m.id);
			$md.addClass(m.pin ? 'pin' : 'star');
			md.render($content, m);
			if ($content.height()>80) {
				$content.addClass("closed");
				$md.append('<div class=opener>');
				$md.reflow();
			}
		});
	}

	md.updateNotableMessages = function(message){
		if (!message.id) return;
		var yetPresent = false, notableMessages = $('#notable-messages .message').map(function(){
			var msg = $(this).data('message');
			if (message && msg.id===message.id) {
				yetPresent = true;
				return message;
			}
			return msg;
		}).get();
		if (!yetPresent && !message.score) return; // nothing to do
		var $page = $('#notablemessagespage'), isPageHidden = !$page.hasClass('selected');
		if (isPageHidden) $page.addClass('selected'); // so that the height computation of messages is possible 
		if (!yetPresent && message) notableMessages.push(message);
		notableMessages = notableMessages.filter(function(m){ return m.score>4 }).sort(function(a,b){
			return ((b.pin||0)-(a.pin||0)) || (b.score-a.score + (b.created-a.created)/7000);
		}).slice(0,20)
		md.showMessages(notableMessages, $('#notable-messages'));
		if (isPageHidden) $page.removeClass('selected');
	}

	md.showError = function(error){
		console.log('ERROR', error);
		if (typeof error === 'string') error = {txt:error};
		$('<div>').addClass('error').append(
			$('<div>').addClass('user error').append("<span>Miaou</span>")
		).append(
			$('<div>').addClass('content').text(error.txt || "an error occured - connection might be damaged")
		).appendTo('#messages');
		if (error.mc && !$('#input').val()) !$('#input').val(error.mc);
		md.scrollToBottom();
	}
	
	// builds a notification message with a close button. The fill callback
	//  is passed the container and a close function
	md.notificationMessage = function(fill){
		var wab = isAtBottom(),
			$md = $('<div>').addClass('notification').appendTo('#messages');
			remove = $md.remove.bind($md, null); // I think this null is worth a blog post (and thanks @zirak)
		$md.append($('<button>').addClass('remover').text('X').click(remove));
		fill($md, remove);
		if (wab) md.scrollToBottom();
	}
	
	// checks immediately and potentially after image loading that
	//  the message div isn't greater than authorized
	function resize($md, wasAtBottom){
		var $content = $md.find('.content');
		var resize = function(){
			$content.removeClass("closed");
			$md.find('.opener,.closer').remove();
			if ($content.height()>158) {
				$content.addClass("closed");
				$md.append('<div class=opener>');
				$md.reflow();
			}
			if (wasAtBottom) md.scrollToBottom();
		}
		resize();
		$content.find('img').load(resize);
	}
	
	// resizes all messages. This must be called each time a container of
	//  .message elements change width.
	md.resizeAll = function(){
		var	todo = [],
			wasAtBottom = isAtBottom(),
			$messages = $('.message');
		$messages.find('.closed').removeClass('closed');
		$messages.find('.opener').remove();
		$messages.each(function(){
			var $md = $(this),
				$content = $md.find('.content'),
				h = $content.height();
			if (h>158) todo.push({$md:$md, $content:$content});
		});
		todo.forEach(function(t){
			t.$md.append('<div class=opener>');
			t.$content.addClass("closed").height();
			t.$md.reflow();
		});
		if (wasAtBottom) md.scrollToBottom();
	}
	
	function updateLoaders(){
		$('.loader').remove();
		var idmap = {}, $messages = $('#messages .message'), messages = [], m;
		for (var i=0; i<$messages.length; i++) {
			messages.push(m = $messages.eq(i).data('message'));
			if (m.id) idmap[m.id] = 1;
		}
		for (var i=0; i<$messages.length; i++) {
			m = messages[i];
			if (m.prev) {
				if (idmap[m.prev]) {
					delete m.prev;
				} else {
					$('<div>').addClass('olderLoader loader').attr('mid', m.prev).text("load older messages").insertBefore($messages[i]);
				}
			}
			if (m.next) {
				if (idmap[m.next]) {
					delete m.next;
				} else {
					$('<div>').addClass('newerLoader loader').attr('mid', m.next).text("load newer messages").insertAfter($messages[i]);
				}
			}
		}
	}
	
	// inserts or updates a message in the main #messages div
	md.addMessage = function(message){
		var messages = md.getMessages(), oldMessage,
			insertionIndex = messages.length - 1, // -1 : insert at begining, i>=0 : insert after i
			wasAtBottom = isAtBottom(),
			$md = $('<div>').addClass('message').data('message', message),
			$user = $('<div>').addClass('user').append($('<span/>').text(message.authorname)).appendTo($md),
			$decorations = $('<div>').addClass('decorations').appendTo($user),
			$mc,
			votesHtml = votesAbstract(message);
		if (message.id) {
			$md.attr('mid', message.id);
			for (var i=messages.length; i--;) {
				if (messages[i].id===message.id) {
					oldMessage = messages[insertionIndex = i];
					break;
				}
			}
			if (!oldMessage) {
				if (messages.length===0 || message.id<messages[0].id || message.created<messages[0].created) {
					insertionIndex = -1;
					// the following line because of the possible special case of a
					//  pin vote being removed by somebody's else 
					if (message.vote && !message[message.vote]) delete message.vote;
				} else {
					while ( insertionIndex && (messages[insertionIndex].id>message.id || messages[insertionIndex].created>message.created) ){
						insertionIndex--;
					};
				}
			}
		}		
		delete message.repliesTo;
		if (message.content) {
			// Updates the link (as reply) to upwards messages
			// To make things simpler, we consider only one link upwards
			var matches = message.content.match(/^\s*@\w[\w\-]{2,}#(\d+)/);
			if (matches) message.repliesTo = +matches[1];
		}		
		if (message.bot) $user.addClass('bot');
		usr.insertInUserList({id:message.author, name:message.authorname}, message.changed||message.created);
		if (message.authorname===me.name) {
			$md.addClass('me');
			$('.error').remove();
		}
		if (~insertionIndex) {
			if (oldMessage) {
				if (message.vote === '?') {
					message.vote = oldMessage.vote;
				}
				if (message.content === oldMessage.content) {
					// we take the old message content, so as not to lose the possible replacements (e.g. boxing)
					$mc = $('#messages > .message[mid='+message.id+'] .content');
				} else if (message.changed !== oldMessage.changed) {
					message.previous = oldMessage;
				}
				$('#messages > .message').eq(insertionIndex).replaceWith($md);
			} else {
				$('#messages > .message').eq(insertionIndex).after($md);
			}
		} else {
			$md.prependTo('#messages');
		}
		if (message.content && message.changed) {
			var $pen = $('<div>&#xe80c;</div>').addClass('decoration pen').appendTo($decorations);
			if (message.previous) $pen.addClass('clickable').attr('title', 'Click for message history');
		}
		if (!message.id) {
			$('<div>&#xe826;</div>').addClass('decoration snap').appendTo($decorations).attr('title', "Flake : only sent to people currently in the room, and will disappear if you refresh the page.");
		}
		if (votesHtml.length) $md.append($('<div/>').addClass('message-votes').html(votesHtml));
		if (!$mc) $mc = $('<div>').addClass('content');
		$mc.appendTo($md);
		md.render($mc, message, oldMessage);
		if (!gui.mobile && userPrefs.datdpl!=="hover") {
			var $mdate = $('<div>').addClass('mdate').text(miaou.formatTime(message.created)).appendTo($md);
			if (userPrefs.datdpl!=="always") $mdate.hide();
		}
		updateLoaders();
		resize($md, wasAtBottom);
		md.showMessageFlowDisruptions();
		if (wasAtBottom && (!message.id || message.id==$('#messages > .message').last().attr('mid'))) md.scrollToBottom();		
	}

	md.showMessageFlowDisruptions = function(){
		var	$messages = $('#messages > .message'),
			lastMessage;
		for (var i=0; i<$messages.length; i++) {
			var	$message = $messages.eq(i),
				message = $message.data('message');
			if (lastMessage && message.created-lastMessage.created > miaou.chat.DISRUPTION_THRESHOLD) {
				$message.addClass('disrupt');
				if (userPrefs.datdpl==="on_breaks" && !gui.mobile) {
					$messages.eq(i-1).add($message).find('.mdate').show();
				}
			} else {
				$message.removeClass('disrupt'); // useful ?
			}
			lastMessage = message;
		}
	}

	md.opener = function(e){
		var wab = isAtBottom();
		$(this).removeClass('opener').addClass('closer').closest('.message').find('.content').removeClass('closed');
		if (wab) md.scrollToBottom();
		e.stopPropagation();
	}
	md.closer = function(e){
		var wab = isAtBottom();
		var $md = $(this).removeClass('closer').addClass('opener').closest('.message');
		$md.find('.content').addClass('closed');
		$md.reflow();
		if (wab) md.scrollToBottom();
		e.stopPropagation();			
	}

	md.showMessageMenus = function(){
		md.hideMessageMenus();
		var $message = $(this), message = $message.data('message'),
			infos = [], $decs = $message.find('.decorations');
		ms.updateStatus(message);
		if (message.status.deletable || message.status.mod_deletable) $('<button>').addClass('deleteButton').text('delete').prependTo($decs);
		if (message.status.editable) $('<button>').addClass('editButton').text('edit').prependTo($decs);
		if (message.status.answerable) $('<button>').addClass('replyButton').text('reply').prependTo($decs);
		if (message.old && !message.editable) infos.push('too old to edit');
		infos.push(miaou.formatRelativeDate((message.created+chat.timeOffset)*1000));
		var h = infos.map(function(txt){ return '<span class=txt>'+txt+'</span>' }).join(' - ') + ' ';
		if (message.id) {
			h += '<a class=link target=_blank href="'+md.permalink(message)+'" title="permalink : right-click to copy">&#xe815;</a> ';
			h += '<a class=makemwin title="float">&#xe81d;</a> ';
			h += voteLevels.slice(0, message.author===me.id ? 1 : 4).slice(usr.checkAuth('admin')?0:1).map(function(l){
				return '<span class="vote'+(l.key===message.vote?' on':'')+'" vote-level='+l.key+' title="'+l.key+'">'+l.icon+'</span>'
			}).join('');
			if (message.pin>(message.vote=="pin") && usr.checkAuth('admin')) {
				h += ' - <span class=unpin>unpin</span>';
			}
		}
		$('<div>').addClass('message-menu').html(h).appendTo(this);
	}
	md.hideMessageMenus = function(){
		$('.message-menu, .editButton, .replyButton, .deleteButton').remove();
	}
	md.toggleMessageMenus = function(){
		($('.message-menu, .editButton, .replyButton, .deleteButton', this).length ? md.hideMessageMenus : md.showMessageMenus).call(this);
	}

	md.goToMessageDiv = function(messageId){
		var $messages = $('#message-scroller'),
			$message = $('.message', $messages).filter(function(){ return $(this).data('message').id==messageId }).addClass('goingto');
		setTimeout(function(){
			var mtop = $message.offset().top;
			if (mtop<0 || mtop>$messages.height()) $messages.animate({scrollTop: mtop+$messages.scrollTop()-25}, 400);
			setTimeout(function(){ $message.removeClass('goingto'); }, 3000);
			hist.showPage();
		}, 300);
	}

	// ensures the messages and the messages around it are loaded,
	//  and then scroll to it and flashes it
	md.focusMessage = function(messageId){
		var $messages = $('#messages > .message'), l = $messages.length,
			beforeId = 0, afterId = 0, mids = new Array($messages.length);
		for (var i=0; i<l; i++) {
			mids[i] = +$messages.eq(i).attr('mid');
			if (mids[i]===messageId) return md.goToMessageDiv(messageId);
		} 
		for (var i=0; i<l; i++) {
			if (mids[i]<messageId) beforeId=mids[i];
			else break;
		}
		for (var i=l; i--;) {
			if (mids[i]>messageId) afterId=mids[i];
			else break;
		}
		ws.emit('get_around', { target:messageId, olderPresent:beforeId, newerPresent:afterId });
	}
	
	// replaces one line of a message
	md.box = function(args){
		var $from = $('<div>'+miaou.mdToHtml(args.from)+'</div>'),
			$m = $('.message[mid='+args.mid+']'),
			wab = isAtBottom();
		$m.find('.content').html(function(_, h){
			return h.replace($from.html(), '<div class=box'+(args.class ? (' class='+args.class) : '')+'>'+args.to+'</div>')
		});
		resize($m, wab);
	}
		
});
