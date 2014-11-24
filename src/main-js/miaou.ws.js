// ws : handles the connection to the server over socket.io (websocket whenever possible)

miaou(function(ws, chat, gui, hist, md, mod, usr, ed){

	ws.init = function(){
		var pingRegex = new RegExp('@'+me.name+'(\\b|$)'),
			info = { state:'connecting', start:Date.now() },
			socket = io.connect(location.origin);

		ws.emit = socket.emit.bind(socket);
		ws.on = socket.on.bind(socket);

		function messagesIn(messages){
			(Array.isArray(messages) ? messages : [messages]).forEach(function(message){
				if (chat.trigger('incoming_message', message) === false) return;
				md.addMessage(message);
				if ((message.changed||message.created)>chat.enterTime && message.content) {
					gui.touch(message.id, pingRegex.test(message.content), message.authorname, message.content);
				}
			});
			md.updateLoaders();
			md.showMessageFlowDisruptions();
		}
		
		// called to merge a message
		function merge(data){
			var	old = $('#messages .message').last().data('message');
			if (!old || old.id!==data.id) {
				console.log("bad merge data", data);
				return;
			}
			var merged = {
				id:old.id, room:old.room,
				author:old.author, authorname:old.authorname,
				created:data.created,
				content: old.content + '\n'+data.add
			};
			messagesIn(merged);
		}

		function setEnterTime(serverTime){
			chat.enterTime = serverTime;
			chat.timeOffset = Date.now()/1000 - serverTime;
		}

		socket
		.on('ready', function(){			
			info.state = 'ready';
			socket.emit('enter', room.id);
		})
		.on('apiversion', function(vers){
			console.log("RECEIVE ", vers);
			if (!miaou.apiversion) miaou.apiversion=vers;
			else if (miaou.apiversion<vers) location.reload();
		})
		.on('auth_dialog', md.showGrantAccessDialog)
		.on('ban', mod.showBan)
		.on('config', function(serverConfig){
			for (var key in serverConfig) chat.config[key] = serverConfig[key];
		})
		.on('set_enter_time', setEnterTime)
		.on('server_commands', function(commands){
			for (var key in commands) chat.commands[key] = commands[key];
		})
		.on('get_room', function(unhandledMessage){
			socket.emit('enter', room.id);
			socket.emit('message', unhandledMessage);
		})
		.on('message', messagesIn)
		.on('messages', messagesIn)
		.on('merge', merge)
		.on('mod_dialog', mod.dialog)
		.on('room', function(r){
			if (room.id!==r.id) {
				console.log('SHOULD NOT HAPPEN!');
			}
			room = r;
			localStorage['successfulLoginLastTime'] = "yes";
			localStorage['room'] = room.id;
			gui.updateTab(0, 0);
			$('#roomname').text(room.name);
			$('#roomdescription').html(miaou.mdToHtml(room.description));
		})
		.on('box', md.box)
		.on('notables', function(notableMessages){
			md.showMessages(notableMessages, $('#notable-messages'));
		})
		.on('notableIds', md.updateNotableMessages)
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
			else gui.scrollToBottom();
			usr.showEntry(me);
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
			gui.touch(0, true, invit.byname, 'You have been invited in a dialog room.');
			gui.scrollToBottom();
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
			md.showMessages(res.results, $('#search-results'));
		})
		.on('autocompleteping', ed.proposepings)
		.on('hist', hist.show)
		.on('pings', chat.pings)
		.on('ping', chat.ping)
		.on('disconnect', function(){ console.log('DISCONNECT') })
		.on('enter',usr.showEntry)
		.on('leave', usr.showLeave)
		.on('miaou.error', md.showError)
		.on('vote', md.applyVote)
		.on('error', function(err){
			// in case of a user having lost his rights, we don't want him to constantly try to connect
			socket.disconnect();
			console.log('ERROR', err);
			md.showError(err);
			md.showError("A fatal error occurred, you're disconnected from the server (you might try refreshing the page)");
		});
	}
});
