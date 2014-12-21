// md is short for "message display"
// Here are functions related to the display of messages in the chat and to the various message element lists

miaou(function(md, chat, gui, hist, usr){
	var renderers = [], unrenderers = [];
	
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

	md.votesAbstract = function(message){
		return chat.voteLevels.map(function(l){
			return message[l.key] ? '<span class="vote '+l.key+'">'+message[l.key]+' '+l.icon+'</span>' : '';
		}).join('');
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
	md.showMessages = function(messages, $div){
		$div.empty();
		for (var i=0; i<messages.length; i++) {
			md.addSideMessageDiv(messages[i], $div);
		}
	}
	
	// builds the message div and append it to the container, managing resizing.
	// May be used for notable messages and search results
	md.addSideMessageDiv = function(m, $div, $repl){
		var	$content = $('<div>').addClass('content');
		var $md = $('<div>').addClass('message').data('message',m).append($content).append(
			$('<div>').addClass('nminfo').html(md.votesAbstract(m) + ' ' + miaou.formatDate((m.created+chat.timeOffset)*1000) + ' by ' + m.authorname)
		);
		if ($repl) $repl.replaceWith($md);
		else $md.appendTo($div);
		if (m.id) $md.attr('mid',m.id);
		$md.addClass(m.pin ? 'pin' : 'star');
		md.render($content, m);
		if ($content.height()>80) {
			$content.addClass("closed");
			$md.append('<div class=opener>');
			$md.reflow();
		}
	}
	
	// if the message is present among notable ones, we replace the div
	//  with the new version
	md.updateNotableMessage = function(m){
		var	$container = $('#notable-messages'),
			$repl = $container.children('.message[mid='+m.id+']');
		if ($repl.length) md.addSideMessageDiv(m, $container, $repl);
	}
	
	// the passed upd object contains
	//  ids : sorted ids of notable messages
	//  m : optional message which is entering the list 
	md.updateNotableMessages = function(upd){
		var	$container = $('#notable-messages'),
			mmap = {};
		$container.find('.message').each(function(){
			var m = $(this).data('message');
			mmap[m.id] = m;
		});
		if (upd.m) mmap[upd.m.id] = upd.m;
		$container.empty();
		upd.ids.forEach(function(id){
			var m = mmap[id];
			if (!m) return console.log("No message in notables for id ", id);
			md.addSideMessageDiv(m, $container);
		});
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
		gui.scrollToBottom();
	}
	
	// builds a notification message with a close button. The fill callback
	//  is passed the container and a close function
	md.notificationMessage = function(fill){
		var	notification = {closelisteners:[]},
			wab = gui.isAtBottom(),
			$md = notification.$md = $('<div>').addClass('notification').appendTo('#notifications').data('notification', notification);
		notification.remove = function(){
			var f;
			while (f = notification.closelisteners.shift()) f();
			$md.remove();
		}
		notification.onclose = function(f){
			notification.closelisteners.push(f);
		}
		$md.append($('<button>').addClass('remover').text('X').click(notification.remove));
		fill($md, notification.remove);
		if (wab) gui.scrollToBottom();
		return notification;
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
			if (wasAtBottom) gui.scrollToBottom();
		}
		resize();
		$content.find('img').load(resize);
	}
	
	// resizes all messages. This must be called each time a container of
	//  .message elements change width.
	md.resizeAll = function(){
		var	todo = [],
			wasAtBottom = gui.isAtBottom(),
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
		if (wasAtBottom) gui.scrollToBottom();
	}
	
	md.updateLoaders = function(){
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
					m.prev = 0;
				} else {
					$('<div>').addClass('olderLoader loader').attr('mid', m.prev).text("load older messages").insertBefore($messages[i]);
				}
			}
			if (m.next) {
				if (idmap[m.next]) {
					m.next = 0;
				} else {
					$('<div>').addClass('newerLoader loader').attr('mid', m.next).text("load newer messages").insertAfter($messages[i]);
				}
			}
		}
	}

	// inserts or updates a message in the main #messages div
	md.addMessage = function(message, shouldStickToBottom){
		var messages = md.getMessages(), oldMessage,
			insertionIndex = messages.length - 1, // -1 : insert at begining, i>=0 : insert after i
			//~ wasAtBottom = gui.isAtBottom(),
			$md = $('<div>').addClass('message').data('message', message),
			$user = $('<div>').addClass('user').append($('<span/>').text(message.authorname)).appendTo($md),
			$decorations = $('<div>').addClass('decorations').appendTo($user),
			$mc,
			votesHtml = md.votesAbstract(message);
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
					if (message.vote && !message[message.vote]) delete message.vote; // fixme ???
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
		resize($md, shouldStickToBottom);
		if (shouldStickToBottom && (!message.id || message.id==$('#messages > .message').last().attr('mid'))) gui.scrollToBottom($md);
		return $md;
	}

	md.showMessageFlowDisruptions = function(){
		var	$messages = $('#messages > .message'),
			lastMessage, $lastMessage;
		$messages.find('.before-disrupt').removeClass('before-disrupt');
		$messages.find('.after-disrupt').removeClass('after-disrupt');
		for (var i=0; i<$messages.length; i++) {
			var	$message = $messages.eq(i),
				message = $message.data('message');
			if (lastMessage && message.created-lastMessage.created > miaou.chat.DISRUPTION_THRESHOLD) {
				$lastMessage.addClass('before-disrupt');
				$message.addClass('after-disrupt');
				if (userPrefs.datdpl==="on_breaks" && !gui.mobile) {
					$messages.eq(i-1).add($message).find('.mdate').show();
				}
			}
			lastMessage = message;
			$lastMessage = $message;
		}
	}

	// replaces one line of a message
	md.box = function(args){
		var $from = $('<div>'+miaou.mdToHtml(args.from)+'</div>'),
			$m = $('.message[mid='+args.mid+']'),
			wab = gui.isAtBottom();
		$m.find('.content').html(function(_, h){
			return h.replace($from.html(), '<div class=box'+(args.class ? (' class='+args.class) : '')+'>'+args.to+'</div>')
		});
		resize($m, wab);
	}
		
});
