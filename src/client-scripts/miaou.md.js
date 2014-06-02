// md is short for "message display"
// Here are function related to the display of messages in the chat and to the various message element lists

var miaou = miaou || {};

(function(md){
	var chat = miaou.chat,
		renderers = [], unrenderers = [],
		voteLevels = [{key:'pin',icon:'&#xe813;'}, {key:'star',icon:'&#xe808;'}, {key:'up',icon:'&#xe800;'}, {key:'down',icon:'&#xe801;'}];

	// registers a function which will be called when a message needs rendering
	// Unless a renderer returns true, the other renderers will be called and
	//  the last one will be the default, markdown based, renderer. If a renderer
	//  has nothing specific to do, it should do nothing and return undefined.
	// Passed arguments are
	//  - $c : the div in which to render the message
	//  - the message
	//  - the previous version of the message if it's a replacement
	// If it's a re-rendering (message was edited, or voted, etc.) the $c div
	//  may be already rendered.
	// $c is already added to the dom, which means it's possible to test the
	//  parents if the rendering depends on it
	md.registerRenderer = function(fun, postrendering){
		renderers[postrendering?'push':'unshift'](fun);
	}
	md.registerUnrenderer = function(fun){
		unrenderers.unshift(fun);
	}
	md.render = function($content, message, oldMessage){
		for (var i=0; i<renderers.length; i++){
			if (renderers[i]($content, message, oldMessage)) break;
		};
	}
	md.unrender = function($content, message){
		for (var i=0; i<unrenderers.length; i++){
			if (unrenderers[i]($content, message)) break;
		};
	}

	function votesAbstract(message){
		return voteLevels.map(function(l){
			return message[l.key] ? '<span class=vote>'+message[l.key]+' '+l.icon+'</span>' : '';
		}).join('');
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

	var isAtBottom = md.isAtBottom = function(){
		var $scroller = $('#messagescroller'), $messages = $('#messages'),
			lastMessage = $messages.find('.message').last(), pt = parseInt($scroller.css('padding-top'));
		return lastMessage.length && lastMessage.offset().top + lastMessage.height() < $scroller.offset().top + $scroller.height() + pt + 5;
	}
	md.scrollToBottom = function(){
		setTimeout(function(){ // because it doesn't always work on Firefox without this 
			$('#messagescroller').scrollTop($('#messagescroller')[0].scrollHeight);
			miaou.hist.showPage();
		},10);
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
			var $md = $('<div>').addClass('message').data('message',m).attr('mid',m.id).append($content).append(
				$('<div>').addClass('nminfo').html(votesAbstract(m) + ' ' + moment((m.created+chat.timeOffset)*1000).format("D MMMM, HH:mm") + ' by ' + m.authorname)
			).appendTo($div);
			md.render($content, m);
			if ($content.height()>80) {
				$content.addClass("closed");
				$md.append('<div class=opener>');
			}
		});
	}

	md.flashRecentNotableMessages = function(){
		var maxAge = 10*24*60*60, $notableMessages = $('#notablemessages .message');
		if ($notableMessages.length>2) maxAge = Math.max(maxAge/5, Math.min(maxAge, $notableMessages.eq(2).data('message').created));
		$notableMessages.each(function(){
			var $m = $(this), m = $m.data('message'), age = (Date.now()/1000 - m.created);
			if (age<maxAge) {
				$m.addClass('flash');
				setTimeout(function(){ $m.removeClass('flash') }, Math.floor((maxAge-age)*4000/maxAge));
			}
		});
		miaou.lastNotableMessagesChangeNotFlashed = false;
	}

	md.updateNotableMessages = function(message){
		var yetPresent = false, notableMessages = $('#notablemessages .message').map(function(){
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
			return b.score-a.score + (b.created-a.created)/7000
		}).slice(0,12)
		md.showMessages(notableMessages, $('#notablemessages'));
		miaou.lastNotableMessagesChangeNotFlashed = true;
		if (isPageHidden) $page.removeClass('selected');
		else if (vis()) md.flashRecentNotableMessages();
	}

	md.updateOlderAndNewerLoaders = function(){
		$('.olderLoader, .newerLoader').remove();
		$('#messages > .message.hasOlder').each(function(){
			$('<div>').addClass('olderLoader').data('mid', this.getAttribute('mid')).text("load older messages").insertBefore(this);
		});
		$('#messages > .message.hasNewer').each(function(){
			$('<div>').addClass('newerLoader').data('mid', this.getAttribute('mid')).text("load newer messages").insertAfter(this);
		});		
	}

	md.showHasOlderThan = function(messageId){
		$('#messages > .message[mid='+messageId+']').addClass('hasOlder');
		md.updateOlderAndNewerLoaders();
	}
	md.showHasNewerThan = function(messageId){
		$('#messages > .message[mid='+messageId+']').addClass('hasNewer');
		md.updateOlderAndNewerLoaders();
	}

	md.showError = function(error){
		console.log('ERROR', error);
		if (typeof error === 'string') error = {txt:error};
		$('<div>').addClass('error').append(
			$('<div>').addClass('user error').text("Miaou")
		).append(
			$('<div>').addClass('content').text(error.txt || "an error occured - connection might be damaged")
		).appendTo('#messages');
		if (error.mc && !$('#input').val()) !$('#input').val(error.mc);
		md.scrollToBottom();
	}

	md.showRequestAccess = function(ar){
		var h, wab = isAtBottom();
		if (!ar.answered) h = "<span class=user>"+ar.user.name+"</span> requests access to the room.";
		else if (ar.outcome) h = "<span class=user>"+ar.user.name+"</span> has been given "+ar.outcome+" right.";
		else h = "<span class=user>"+ar.user.name+"</span> has been denied entry by <span class=user>"+ar.answerer.name+"</span>.";
		var $md = $('<div>').html(h).addClass('notification').data('user', ar.user).appendTo('#messages');
		$md.append($('<button>').addClass('remover').text('X').click(function(){ $md.remove() }));
		if (chat.checkAuth('admin')) {
			$('<button>').text('Manage Users').click(function(){ $('#auths').click() }).appendTo($md);
			if (!vis()) miaou.updateTab(chat.oldestUnseenPing, ++chat.nbUnseenMessages);
		}
		if (ar.request_message) {
			$('<div>').addClass('message').append(
				$('<div>').addClass('user').text(ar.user.name)
			).append(
				$('<div>').addClass('content').append(miaou.mdToHtml(ar.request_message))
			).appendTo($md);
		}
		if (wab) md.scrollToBottom();
	}
	
	// checks immediately and potentially after image loading that
	//  the message div isn't greater than authorized
	function resize($md, wasAtBottom){
		var $content = $md.find('.content');
		var resize = function(){
			var h = $content.height();
			if ($content.height()>158) {
				$md.find('.opener').remove();
				$content.addClass("closed");
				h = $content.height()
				$md.append('<div class=opener>');
			}
			$md.find('.user').height(h).css('line-height',h+'px');
			if (wasAtBottom) md.scrollToBottom();
			//else miaou.hist.showPage(); ?
		}
		resize();
		$content.find('img').load(resize);
	}

	// inserts or updates a message in the main #messages div
	md.addMessage = function(message){
		var messages = md.getMessages(), oldMessage,
			insertionIndex = messages.length, // -1 : insert at begining, i>=0 : insert after i
			wasAtBottom = isAtBottom(),
			$md = $('<div>').addClass('message').data('message', message).attr('mid', message.id),
			$user = $('<div>').addClass('user').text(message.authorname).appendTo($md),
			$decorations = $('<div>').addClass('decorations').appendTo($user),
			$mc,
			votesHtml = votesAbstract(message);
		if (messages.length===0 || message.id<messages[0].id) {
			insertionIndex = -1;
		} else {
			while (insertionIndex && messages[--insertionIndex].id>message.id){};
		}
		if (message.bot) $user.addClass('bot');
		else chat.topUserList({id: message.author, name: message.authorname});
		if (message.authorname===me.name) {
			$md.addClass('me');
			$('.error').remove();
		}
		if (!message.content) {
			$md.addClass('deleted');
		} else if (message.changed) {
			//$md.addClass('edited');
			$('<div>&#xe80c;</div>').addClass('decoration').appendTo($decorations);
		}
		if (~insertionIndex) {
			if (messages[insertionIndex].id===message.id) {
				oldMessage = messages[insertionIndex];
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
		if (votesHtml.length) $md.append($('<div/>').addClass('messagevotes').html(votesHtml));
		if (!$mc) $mc = $('<div>').addClass('content');
		$mc.appendTo($md);
		md.render($mc, message, oldMessage);
		resize($md, wasAtBottom);
		md.showMessageFlowDisruptions();
		md.updateOlderAndNewerLoaders();
		if (wasAtBottom && message.id==$('#messages > .message').last().attr('mid')) md.scrollToBottom();
	}


	md.showMessageFlowDisruptions = function(){
		var lastMessage;
		$('#messages > .message').removeClass('disrupt').each(function(){
			var $this = $(this), message = $this.data('message');
			if (lastMessage && message.created-lastMessage.created > miaou.chat.DISRUPTION_THRESHOLD) $this.addClass('disrupt')
			lastMessage = message;
		});
	}

	md.opener = function(e){
		var wab = isAtBottom();
		$(this).removeClass('opener').addClass('closer').closest('.message').find('.content').removeClass('closed');
		if (wab) md.scrollToBottom();
		e.stopPropagation();
	}
	md.closer = function(e){
		$(this).removeClass('closer').addClass('opener').closest('.message').find('.content').addClass('closed');
		e.stopPropagation();			
	}

	md.showMessageMenus = function(){
		md.hideMessageMenus();
		var $message = $(this), message = $message.data('message'), infos = [],
			created = message.created+chat.timeOffset, m = moment(created*1000);
		miaou.ms.updateStatus(message);
		if (message.status.deletable) $('<button>').addClass('deleteButton').text('delete').appendTo($message.find('.user'));
		if (message.status.editable) $('<button>').addClass('editButton').text('edit').appendTo($message.find('.user'));
		if (message.status.answerable) $('<button>').addClass('replyButton').text('reply').appendTo($message.find('.user'));
		if (message.old && !message.editable) infos.push('too old to edit');
		infos.push(formatMoment(m));
		$('<div>').addClass('messagemenu').html(
			infos.map(function(txt){ return '<span class=txt>'+txt+'</span>' }).join(' - ') + ' ' +
			'<a class=link target=_blank href="'+miaou.md.permalink(message)+'" title="permalink : right-click to copy">&#xe815;</a> ' + 
			'<a class=makemwin title="float">&#xe81d;</a> ' + 
			voteLevels.slice(0, message.author===me.id ? 1 : 4).slice(chat.checkAuth('admin')?0:1).map(function(l){
				return '<span class="vote'+(l.key===message.vote?' on':'')+'" vote-level='+l.key+' title="'+l.key+'">'+l.icon+'</span>'
			}).join('')
		).appendTo(this);
	}
	md.hideMessageMenus = function(){
		$('.messagemenu, .editButton, .replyButton, .deleteButton').remove();
	}
	md.toggleMessageMenus = function(){
		($('.messagemenu, .editButton, .replyButton, .deleteButton', this).length ? md.hideMessageMenus : md.showMessageMenus).call(this);
	}

	md.showUserHoverButtons = function(){
		var user = $(this).data('user');
		if (user.name===me.name) return;
		$('<button>').addClass('pingButton').text('ping').click(function(){
			miaou.editor.ping(user.name);
		}).appendTo(this);
		$('<button>').addClass('pmButton').text('dialog').click(function(){
			miaou.pmwin = window.open(); // not so clean...
			miaou.socket.emit('pm', user.id);			
		}).appendTo(this);
	}
	md.hideUserHoverButtons = function(){
		$('.pingButton,.pmButton').remove();
	}

	md.goToMessageDiv = function(messageId){
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
		for (var i=l; i-->0;) {
			if (mids[i]>messageId) afterId=mids[i];
			else break;
		}
		miaou.socket.emit('get_around', { target:messageId, olderPresent:beforeId, newerPresent:afterId });
	}
	
	// replaces one line of a message
	md.box = function(args){
		var $from = $('<div>'+miaou.mdToHtml(args.from)+'</div>'),
			$m = $('.message[mid='+args.mid+']'),
			wab = isAtBottom();
		$m.find('.content').html(function(_,h){
			return h.replace($from.html(), '<div class=box>'+args.to+'</div>')
		});
		resize($m, wab);
	}
	
})(miaou.md = {});
