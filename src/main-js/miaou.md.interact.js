// md is short for "message display"
// Here are functions related to the rendering of user interactions on messages :
//  - going to a message
//  - hovering a message
//  - closing/opening a big message

miaou(function(md, chat, gui, hist, links, locals, ms, notif, time, usr, ws, wz){

	// o : {mid, add, remove, voter}
	//	add and remove are in [ up, down, star, pin ] (optional)
	md.applyVote = function(o){
		$('.message[mid='+o.mid+']').each(function(){
			var	$md = $(this),
				m = $md.dat('message');
			if (o.add) m[o.add] = (m[o.add]||0)+1;
			if (o.remove) m[o.remove] = (m[o.remove]||0)-1;
			if (!o.voter || o.voter===locals.me.id) m.vote = o.add || null;
			if ($md.closest('#messages').length) {
				$md.find('.message-votes').remove();
				$md.append($('<div/>').addClass('message-votes').html(md.votesAbstract(m)));
				md.hideMessageHoverInfos();
			} else {
				$md.find('.nminfo').html(
					md.votesAbstract(m) + ' ' + time.formatTime(m.created) + ' by ' + m.authorname
				);
			}
		});
	}

	md.opendIfClosed = function($message){
		var $opener = $message.find(".opener");
		if (!$opener.length) return;
		$opener.removeClass('opener').addClass('closer');
		var wab = gui.isAtBottom();
		$message.find('.content').removeClass('closed');
		notif.userAct($message.dat('message').id);
		if (wab) gui.scrollToBottom();
		if (!gui.mobile) wz.updateAll();
	}
	md.opener = function(e){
		md.opendIfClosed($(this).closest(".message"));
		return false;
	}
	md.closer = function(e){
		var	wab = gui.isAtBottom(),
			$md = $(this).removeClass('closer').addClass('opener').closest('.message');
		$md.find('.content').addClass('closed');
		notif.userAct($md.dat('message').id);
		if (wab) gui.scrollToBottom();
		e.stopPropagation();
		if (!gui.mobile) wz.updateAll();
		return false;
	}

	// returns the html needed to fill the message menu (the thing at the top right visible on hover)
	// Message status is assumed to be up to date
	function getMessageMenuHtml(message){
		var infos = [];
		if (message.old && !message.editable) infos.push('too old to edit');
		infos.push(time.formatRelativeTime(message.created));
		var h = infos.map(function(txt){ return '<span class=txt>'+txt+'</span>' }).join(' - ') + ' ';
		h += `<a class=copysrc>`
		+ '&#xf121;' // fontello icon-code
		+ '</a> ';
		if (message.id) {
			h += '<a class=link target=_blank href="'
			+ links.permalink(message)
			+ '" title="permalink : right-click to copy a direct link to the message">'
			+ '&#xe80e;' // fontello icon-link
			+ '</a> ';
			if (!gui.mobile) {
				h += '<a class=makemwin title="float: open the message in a floating window">'
				+ '&#xe82a;' // fontello icon-window
				+ '</a> ';
			}
			var possibleVotes = [];
			if (usr.checkAuth('admin')) possibleVotes.push(chat.voteLevels[0]); // pin
			if (message.author!==locals.me.id || usr.checkAuth('admin')) {
				possibleVotes.push(chat.voteLevels[1]); // star
			}
			possibleVotes.push(chat.voteLevels[2]); // up
			possibleVotes.push(chat.voteLevels[3]); // down
			h += possibleVotes.map(function(l){
				return '<span class="vote'+(l.key===message.vote?' on':'')+
				'" vote-level='+l.key+' title="'+l.key+'">'+l.icon+'</span>'
			})
			.join('');
			if (message.pin>(message.vote=="pin") && usr.checkAuth('admin')) {
				h += ' - <span class=unpin>unpin</span>';
			}
		}
		return h;
	}

	var $hoveredMessage;
	md.showMessageHoverInfos = function(){
		md.hideMessageHoverInfos();
		var	$message = $(this),
			message = $message.dat('message'),
			$decs = $message.find('.decorations');
		$hoveredMessage = $message;
		ms.updateStatus(message);
		if (message.status.deletable || message.status.mod_deletable) {
			$('<button>').addClass('deleteButton').text('del.').attr("title", "delete").prependTo($decs);
		}
		if (message.status.editable) {
			$('<button>').addClass('editButton').text('edit').prependTo($decs);
		}
		if (message.status.continuable) {
			$('<button>').addClass('continueButton').text('cont.').attr("title", "continue").prependTo($decs);
		}
		if (message.status.answerable) {
			$('<button>').addClass('replyButton').text('reply').prependTo($decs);
		}
		$('<div>').addClass('message-menu').html(getMessageMenuHtml(message)).appendTo(this);
		return false;
	}
	md.hideMessageHoverInfos = function(){
		$('.message-menu,.editButton,.continueButton,.replyButton,.deleteButton').remove();
		$hoveredMessage = null;
		return false;
	}
	md.toggleMessageHoverInfos = function(e){
		if (["A", "INPUT", "SELECT"].includes(e.target.tagName)) return;
		if ($('.message-menu, .editButton, .replyButton, .deleteButton', this).length) {
			md.hideMessageHoverInfos.call(this);
		} else {
			md.showMessageHoverInfos.call(this);
		}
		return false;
	}
	// mainly a workaround for some mouseleave events I can't catch
	md.hideNotHoveredMessageInfos = function(e){
		if ($hoveredMessage) {
			var off = $hoveredMessage.offset();
			var x = e.pageX-off.left, y = e.pageY-off.top;
			if (x<0 || x>$hoveredMessage.outerWidth() || y<0 || y>$hoveredMessage.outerHeight()) {
				md.hideMessageHoverInfos();
			}
		}
	}

	// argument : messageId or $messageDiv
	md.goToMessageDiv = function(arg){
		var	$messages = gui.$messageScroller,
			mstop = $messages.offset().top,
			$message = typeof arg === "number" || typeof arg === "string" ? $('.message[mid='+arg+']', $messages) : arg;
		if (!$message.length) return;
		$message.addClass('goingto');
		setTimeout(function(){
			var mtop = $message.offset().top;
			if (mtop<mstop || mtop>mstop+$messages.height()) {
				$messages.animate({scrollTop: mtop-mstop+$messages.scrollTop()-25}, 400);
			}
			setTimeout(function(){ $message.removeClass('goingto'); }, 3000);
			hist.showPage();
		}, 300);
	}

	// ensures the messages and the messages around it are loaded,
	//  and then scroll to it and flashes it
	md.focusMessage = function(messageId){
		if (!messageId) return;
		var	$messages = $('#messages .message'),
			i,
			l = $messages.length,
			beforeId = 0,
			afterId = 0,
			mids = new Array($messages.length);
		for (i=0; i<l; i++) {
			mids[i] = +$messages.eq(i).attr('mid');
			if (mids[i]===messageId) return md.goToMessageDiv(messageId);
		}
		for (i=0; i<l; i++) {
			if (mids[i]<messageId) beforeId=mids[i];
			else break;
		}
		for (i=l; i--;) {
			if (mids[i]>messageId) afterId=mids[i];
			else break;
		}
		ws.emit('get_around', { target:messageId, olderPresent:beforeId, newerPresent:afterId });
	}

});
