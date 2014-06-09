var miaou = miaou || {};

(function(){
	var pingRegex, info;

	function con(){
		var chat = miaou.chat,
			md = miaou.md;
		
		info = { state:'connecting', start:Date.now(), nbmessages:0 };
		var	socket = miaou.socket = io.connect(location.origin);

		function setEnterTime(serverTime){
			chat.enterTime = serverTime;
			chat.timeOffset = Date.now()/1000 - serverTime;
		}

		socket.on('ready', function(){			
			info.state = 'ready';
			socket.emit('enter', room.id);
		})
		.on('set_enter_time', setEnterTime)
		.on('server_commands', function(commands){
			for (var key in commands) chat.commands[key] = commands[key];
		})
		.on('get_room', function(unhandledMessage){
			socket.emit('enter', room.id);
			socket.emit('message', unhandledMessage);
		})
		.on('message', function(message){
			if (chat.trigger('incoming_message', message) === false) return;
			info.nbmessages++;
			md.addMessage(message);
			md.updateNotableMessages(message);
			if (message.created>chat.enterTime && message.content) {
				miaou.touch(message.id, pingRegex.test(message.content), message.authorname, message.content);
			}
		})
		.on('room', function(r){
			if (room.id!==r.id) {
				console.log('SHOULD NOT HAPPEN!');
			}
			room = r;
			localStorage['successfulLoginLastTime'] = "yes";
			localStorage['room'] = room.id;
			miaou.updateTab(0, 0);
			$('#roomname').text(room.name);
			$('#roomdescription').html(miaou.mdToHtml(room.description));
		})
		.on('box', md.box)
		.on('notable_message', md.updateNotableMessages)
		.on('has_older', md.showHasOlderThan)
		.on('has_newer', md.showHasNewerThan)
		.on('request', md.showRequestAccess)
		.on('reconnect', function(){
			console.log('RECONNECT, sending room again');
			setTimeout(function(){
				socket.emit('enter', room.id);
			}, 500); // first message after reconnect not always received by server if I don't delay it (todo : elucidate and clean)
		})
		.on('welcome', function(){
			info.state = 'connected';
			if (location.hash) md.focusMessage(+location.hash.slice(1));
			else md.scrollToBottom();
			chat.showEntry(me);
		})
		.on('invitation', function(invit){
			var $md = $('<div>').html(
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
		})
		.on('pm_room', function(roomId){
			miaou.pmwin.location = roomId;
		})
		.on('go_to', function(messageId){
			setTimeout(function(){ md.goToMessageDiv(messageId) }, 200);
		})
		.on('found', function(res){
			if (res.search.pattern!=$('#searchInput').val().trim()) {
				console.log('received results of another search', $('#searchInput').val().trim(), res);
				return;
			}
			md.showMessages(res.results, $('#searchresults'));
		})
		.on('autocompleteping', miaou.editor.proposepings)
		.on('hist', miaou.hist.show)
		.on('pings', chat.pings)
		.on('ping', chat.ping)
		.on('disconnect', function(){
			console.log('DISCONNECT');
		})
		.on('enter', chat.showEntry)
		.on('leave', chat.showLeave)
		.on('miaou.error', md.showError);	
	}

	miaou.startChatWS = function(){
		pingRegex = new RegExp('@'+me.name+'(\\b|$)');
		con();
	}
})();
