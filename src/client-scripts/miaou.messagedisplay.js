// md is short for "message display"
// Here are function related to the display of messages in the chat and to the various message element lists

var miaou = miaou || {};

(function(md){
	var chat = miaou.chat,
		voteLevels = [{key:'pin',icon:'&#xe813;'}, {key:'star',icon:'&#xe808;'}, {key:'up',icon:'&#xe800;'}, {key:'down',icon:'&#xe801;'}];

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

	function isAtBottom(){
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

	md.permalink = function(message){
		return location.href.match(/^[^&#]*/) + '#' + message.id;
	}

	// used for notable messages and search results
	md.showMessages = function(messages, $div) {
		$div.empty();
		messages.forEach(function(m){
			if (!m.content) return;
			var $content = $('<div>').addClass('content').html(miaou.mdToHtml(m.content, false, m.authorname));
			var $md = $('<div>').addClass('message').data('message',m).attr('mid',m.id).append($content).append(
				$('<div>').addClass('nminfo').html(votesAbstract(m) + ' ' + moment((m.created+chat.timeOffset)*1000).format("D MMMM, HH:mm") + ' by ' + m.authorname)
			).appendTo($div)
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
		if (!yetPresent && !message.score) return; // nothing to do
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
		$('<div>').addClass('error').append(
			$('<div>').addClass('user error').text("Miaou")
		).append(
			$('<div>').addClass('content').text(typeof error === "string" ? error : "an error occured - connexion might be damaged")
		).appendTo('#messages');
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

	md.addMessage = function(message){
		var messages = md.getMessages(), insertionIndex = messages.length; // -1 : insert at begining, i>=0 : insert after i
		var wasAtBottom = isAtBottom();
		if (messages.length===0 || message.id<messages[0].id) {
			insertionIndex = -1;
		} else {
			while (insertionIndex && messages[--insertionIndex].id>message.id){};
		}
		var $md = $('<div>').addClass('message').data('message', message).attr('mid', message.id),
			$user = $('<div>').addClass('user').text(message.authorname).appendTo($md),
			hc = message.content ? miaou.mdToHtml(message.content, true, message.authorname) : '',
			$content = $('<div>').addClass('content').append(hc).appendTo($md);
		if (message.authorname===me.name) {
			$md.addClass('me');
			$('.error').remove();
		}
		if (!message.content) $md.addClass('deleted');
		else if (message.changed) $md.addClass('edited');
		if (~insertionIndex) {
			if (messages[insertionIndex].id===message.id) {
				if (message.vote==='?') {
					message.vote = messages[insertionIndex].vote;
				}
				$('#messages > .message').eq(insertionIndex).replaceWith($md);
			} else {
				$('#messages > .message').eq(insertionIndex).after($md);				
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
			if (wasAtBottom) md.scrollToBottom();
			else miaou.hist.showPage();
		}
		resize();
		$content.find('img').load(resize);
		chat.topUserList({id: message.author, name: message.authorname});
		var votesHtml = votesAbstract(message);
		if (votesHtml.length) $md.append($('<div/>').addClass('messagevotes').html(votesHtml));
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
		$(this).removeClass('opener').addClass('closer').closest('.message').find('.content').removeClass('closed');
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
		if (message.author===me.id) {
			if (Date.now()/1000 - created < miaou.chat.MAX_AGE_FOR_EDIT) {
				if (message.content) {
					$('<button>').addClass('deleteButton').text('delete').appendTo($message.find('.user'));
					$('<button>').addClass('editButton').text('edit').appendTo($message.find('.user'));
				}
			} else {
				infos.push('too old for edition');
			}
		} else {
			$('<button>').addClass('replyButton').text('reply').appendTo($message.find('.user'));
		}
		infos.push(formatMoment(m));
		$('<div>').addClass('messagemenu').html(
			infos.map(function(txt){ return '<span class=txt>'+txt+'</span>' }).join(' - ') + ' ' +
			'<a class=link target=_blank href="'+miaou.md.permalink(message)+'" title="permalink : right-click to copy">&#xe815;</a> ' + 
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
		$('<button>').addClass('pmButton').text('pm').click(function(){
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
})(miaou.md = {});
