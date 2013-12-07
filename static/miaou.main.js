var miaou = miaou || {};
(function(){
	var NB_MESSAGES = 100,
		MAX_AGE_FOR_EDIT = 800, // seconds (should be coherent with server settings) 
		DISRUPTION_THRESHOLD = 60*60, // seconds
		nbUnseenMessages = 0, nbUnseenPings = 0,
		users = [],
		messages = [];
	
	function pingRegex(name) {
		return new RegExp('@'+name+'(\\b|$)')
	}

	function scrollToBottom(){
		$('#messages').scrollTop($('#messages')[0].scrollHeight)
	}
	
	function showMessageFlowDisruptions(){
		$('.message').removeClass('disrupt').filter(function(i){
			// we're assuming here that the elements are coherent with the messages array
			return (i>0 && messages[i].created-messages[i-1].created > DISRUPTION_THRESHOLD);
		}).addClass('disrupt');
	}

	function makeMessageDiv(message){
		var $content = $('<div>').addClass('content').append(miaou.mdToHtml(message.content));
		var $md = $('<div>').addClass('message').append(
			$('<div>').addClass('user').text(message.authorname)
		).append($content).data('message', message).attr('mid', message.id);
		if (message.authorname===me.name) $md.addClass('me');
		if ($content.height()>150) {
			$content.addClass("closed");
			$md.append('<div class=opener>');
		}
		$content.find('img').load(scrollToBottom);
		if (message.changed) $md.addClass('edited');
		return $md;
	}

	function addMessage(message){
		var insertionIndex = messages.length; // -1 : insert at end, i>=0 : insert before i
		if (messages.length===0 || message.id>messages[messages.length-1].id) {
			insertionIndex = -1;
		} else if (messages[0].id>message.id) {
			insertionIndex = 0;
		} else {
			while (messages[--insertionIndex].id>message.id);
		}
		var $md = makeMessageDiv(message);
		if (~insertionIndex) {
			if (messages[insertionIndex].id===message.id) {
				messages[insertionIndex] = message;
				$('#messages .message').eq(insertionIndex).replaceWith($md);				
			} else {
				messages.splice(insertionIndex, 0, message);
				$('#messages .message').eq(insertionIndex).before($md);				
			}
		} else {
			messages.push(message);
			$md.appendTo('#messages');
			addToUserList({id: message.author, name: message.authorname});
			if (!vis()) {
				if (pingRegex(me.name).test(message.content)) {
					miaou.notify(room, message.authorname, message.content);
					nbUnseenPings++;
				}
				document.title = (nbUnseenPings?'*':'') + ++nbUnseenMessages + ' - ' + (room ? room.name : 'no room');
			}
		}
		showMessageFlowDisruptions();
		scrollToBottom();
	}
	
	function showError(error){
		console.log('ERROR', error);
		var $md = $('<div>').addClass('message error').append(
			$('<div>').addClass('user error').text("Miaou Server")
		).append(error).appendTo('#messages');
		scrollToBottom();
	}
	
	function updateUserList(user, keep){
		for (var i=0; i<users.length; i++) {
			if (users[i].name===user.name) {
				users.splice(i,1);
				break;
			}
		}
		if (keep) users.push(user);
		$('#users').html(users.map(function(u){ return '<span class=user>'+u.name+'</span>' }).reverse().join(''));
	}
	function addToUserList(user){
		updateUserList(user, true);
	}
	
	$(function(){
		vis(function(){
			if (vis()) {
				nbUnseenMessages = 0; nbUnseenPings = 0;
				document.title = room ? room.name : 'no room';						
			}
		});
		var socket = io.connect(location.origin);
		socket.emit('enter', room.id);		
		socket.on('get_room', function(unhandledMessage){
			console.log('Server asks room');
			socket.emit('enter', room.id);
			socket.emit('message', unhandledMessage);
		}).on('message', function(message){
			addMessage(message);
		}).on('room', function(r){
			if (room.id!==r.id) {
				console.log('SHOULD NOT HAPPEN!');
			}
			room = r;
			localStorage['successfulLoginLastTime'] = "yes";
			localStorage['room'] = room.id;
			document.title = room.name;
			$('#roomname').text('Room : ' + room.name);
			$('#roomdescription').html(miaou.mdToHtml(room.description));
		}).on('reconnect', function(){
			console.log('RECONNECT, sending room again');
			setTimeout(function(){
				socket.emit('enter', room.id);
			}, 500); // first message after reconnect not always received by server if I don't delay it (todo : elucidate and clean)
		}).on('disconnect', function(){
			console.log('DISCONNECT');
		}).on('enter', addToUserList).on('leave', updateUserList).on('error', showError);
		
		$('#messages').on('click', '.message .content img', function(){ window.open(this.src) })
		.on('click', '.opener', function(){
			$(this).removeClass('opener').addClass('closer').closest('.message').find('.content').removeClass('closed');
		}).on('click', '.closer', function(){
			$(this).removeClass('closer').addClass('opener').closest('.message').find('.content').addClass('closed');					
		}).on('mouseenter', '.message', function(){
			var message = $(this).data('message'), menuItems = [];
			if ($(this).hasClass('me')) menuItems.push(Date.now()/1000 - message.created < MAX_AGE_FOR_EDIT ? 'click to edit' : 'too old for edition');
			menuItems.push(moment(message.created*1000).fromNow());
			if (message.changed) menuItems.push('edited ' + moment(message.changed*1000).fromNow());
			$('<div>').addClass('messageinfo').html(menuItems.join(' - ')).appendTo(this);
		}).on('mouseleave', '.message', function(){
			$('.messageinfo').remove();
		}).on('click', 'a', function(e){
			e.stopPropagation();
		}).on('click', '.message.me', function(){
			var message = $(this).data('message');
			if (Date.now()/1000 - message.created < MAX_AGE_FOR_EDIT) $('#input').editMessage(message);
		});

		$('#input').editFor(socket);
		$('#help').click(function(){ window.open('help#Writing_Messages') });
		
		$('#changeroom').click(function(){ window.open('rooms') });
		$('#editroom').click(function(){ location='room?id='+room.id });
		if (room.auth!='admin' && room.auth!='own') $('#editroom').hide();
		$('#me').text(me.name);
		console.log('Miaou!');
	});
})();
