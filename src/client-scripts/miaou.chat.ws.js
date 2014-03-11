var miaou = miaou || {};

miaou.startChatWS = function(){
	var socket = miaou.socket = io.connect(location.origin),
		pingRegex = new RegExp('@'+me.name+'(\\b|$)'),
		chat = miaou.chat,
		md = miaou.md;
		
	function setEnterTime(serverTime){
		chat.enterTime = serverTime;
		chat.timeOffset = Date.now()/1000 - serverTime;
	}

	socket.on('ready', function(){			
		socket.emit('enter', room.id, setEnterTime);
	}).on('get_room', function(unhandledMessage){
		socket.emit('enter', room.id, setEnterTime);
		socket.emit('message', unhandledMessage);
	}).on('message', function(message){
		//~ console.log('received:', message);
		md.addMessage(message);
		md.updateNotableMessages(message);
		if (message.created>chat.enterTime) {
			var visible = vis(), ping = pingRegex.test(message.content);
			if (ping) {
				if (visible) {
					chat.clearPings();
				} else {
					miaou.notify(room, message.authorname, message.content);
					if (!chat.oldestUnseenPing) chat.oldestUnseenPing = message.id;
				}
			}
			if (!visible) document.title = (chat.oldestUnseenPing?'*':'') + ++chat.nbUnseenMessages + ' - ' + room.name;
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
	}).on('notable_message', md.updateNotableMessages)
	.on('has_older', md.showHasOlderThan)
	.on('has_newer', md.showHasNewerThan)
	.on('request', md.showRequestAccess)
	.on('reconnect', function(){
		console.log('RECONNECT, sending room again');
		setTimeout(function(){
			socket.emit('enter', room.id, setEnterTime);
		}, 500); // first message after reconnect not always received by server if I don't delay it (todo : elucidate and clean)
	}).on('welcome', function(){
		if (location.hash) md.focusMessage(+location.hash.slice(1));
		else md.scrollToBottom();
		chat.showEntry(me);
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
		md.scrollToBottom();
	}).on('disconnect', function(){
		console.log('DISCONNECT');
	}).on('enter', chat.showEntry).on('leave', chat.showLeave).on('error', md.showError);

	console.log('Miaou!');
}
