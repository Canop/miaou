// md is short for "message display"
// Here are functions related to the rendering of user interactions on messages :
//  - going to a message
//  - hovering a message
//  - closing/opening a big message

miaou(function(md, chat, gui, hist, ms, usr, ws){

	// o : mid, level, diff, self, voter
	// diff  : +1 or -1
	// level : up, down, star, pin
	md.applyVote = function(o){
		$('.message[mid='+o.mid+']').each(function(){
			var	$md = $(this),
				m = $md.data('message');
			m[o.level] = (m[o.level]||0)+o.diff;
			if (o.voter===me.id) m.vote = o.diff>0 ? o.level : null;
			if ($md.closest('#messages').length) {
				$md.find('.message-votes').remove();
				$md.append($('<div/>').addClass('message-votes').html(md.votesAbstract(m)));
				md.hideMessageHoverInfos();
			} else {
				$md.find('.nminfo').html(
					md.votesAbstract(m) + ' ' + miaou.formatDate((m.created+chat.timeOffset)*1000) + ' by ' + m.authorname
				);
			}
		});
	}

	md.opener = function(e){
		var wab = gui.isAtBottom();
		$(this).removeClass('opener').addClass('closer').closest('.message').find('.content').removeClass('closed');
		if (wab) gui.scrollToBottom();
		e.stopPropagation();
	}
	md.closer = function(e){
		var wab = gui.isAtBottom();
		var $md = $(this).removeClass('closer').addClass('opener').closest('.message');
		$md.find('.content').addClass('closed');
		$md.reflow();
		if (wab) gui.scrollToBottom();
		e.stopPropagation();			
	}
		
	// returns the html needed to fill the message menu (the thing at the top right visible on hover)
	// Message status is assumed to be up to date
	function getMessageMenuHtml(message){
		var infos = [];
		if (message.old && !message.editable) infos.push('too old to edit');
		infos.push(miaou.formatRelativeDate((message.created+chat.timeOffset)*1000));
		var h = infos.map(function(txt){ return '<span class=txt>'+txt+'</span>' }).join(' - ') + ' ';
		if (message.id) {
			h += '<a class=link target=_blank href="'+md.permalink(message)+'" title="permalink : right-click to copy">&#xe815;</a> ';
			h += '<a class=makemwin title="float">&#xe81d;</a> ';
			h += chat.voteLevels.slice(0, message.author===me.id ? 1 : 4).slice(usr.checkAuth('admin')?0:1).map(function(l){
				return '<span class="vote'+(l.key===message.vote?' on':'')+'" vote-level='+l.key+' title="'+l.key+'">'+l.icon+'</span>'
			}).join('');
			if (message.pin>(message.vote=="pin") && usr.checkAuth('admin')) {
				h += ' - <span class=unpin>unpin</span>';
			}
		}
		return h;
	}

	md.showMessageHoverInfos = function(){
		md.hideMessageHoverInfos();
		var	$message = $(this),
			message = $message.data('message'),
			$decs = $message.find('.decorations');
		ms.updateStatus(message);
		if (message.status.deletable || message.status.mod_deletable) $('<button>').addClass('deleteButton').text('delete').prependTo($decs);
		if (message.status.editable) $('<button>').addClass('editButton').text('edit').prependTo($decs);
		if (message.status.answerable) $('<button>').addClass('replyButton').text('reply').prependTo($decs);
		$('<div>').addClass('message-menu').html(getMessageMenuHtml(message)).appendTo(this);
	}
	md.hideMessageHoverInfos = function(){
		$('.message-menu, .editButton, .replyButton, .deleteButton').remove();
	}
	md.toggleMessageHoverInfos = function(){
		($('.message-menu, .editButton, .replyButton, .deleteButton', this).length ? md.hideMessageHoverInfos : md.showMessageHoverInfos).call(this);
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
		

});
