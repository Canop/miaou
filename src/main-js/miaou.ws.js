// ws : handles the connection to the server over socket.io (websocket whenever possible)

miaou(function(ws, chat, ed, gui, hist, locals, md, mod, notif, usr, watch){

	ws.init = function(){
		var pingRegex = new RegExp('@'+locals.me.name+'(\\b|$)'),
			info = { state:'connecting', start:Date.now() },
			socket = io.connect(location.origin);

		ws.emit = socket.emit.bind(socket);
		ws.on = socket.on.bind(socket);

		function messagesIn(messages){
			var	visible = vis(),
				isAtBottom = gui.isAtBottom(),
				shouldStickToBottom = isAtBottom || info.state!=='connected';
			messages = Array.isArray(messages) ? messages.sort(function(m1,m2){ return m1.id-m2.id }) : [messages];
			messages.forEach(function(message){
				if (chat.trigger('incoming_message', message) === false) return;
				if (shouldStickToBottom && !visible) {
					var $lastSeen = $('#messages .rvis').last();
					if ($lastSeen.length) {
						if ($lastSeen.offset().top<10) shouldStickToBottom = false;
					}
				}
				var $md = md.addMessage(message, shouldStickToBottom);
				$md.addClass(visible||info.state!=='connected' ? 'rvis' : 'rnvis');
				var ping = pingRegex.test(message.content);
				if (message.id) md.updateNotableMessage(message);
				if (
					(message.id||ping) && (message.changed||message.created)>chat.enterTime && message.content
				) {
					notif.touch(message.id, ping, message.authorname, message.content, locals.room, $md);
				}
			});
			md.updateLoaders();
			md.showMessageFlowDisruptions();
		}

		function setEnterTime(serverTime){
			chat.enterTime = serverTime;
			chat.timeOffset = Date.now()/1000 - serverTime;
		}

		socket
		.on('ready', function(){			
			info.state = 'entering';
			socket.emit('enter', locals.room.id);
		})
		.on('apiversion', function(vers){
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
			socket.emit('enter', locals.room.id);
			socket.emit('message', unhandledMessage);
		})
		.on('message', messagesIn)
		.on('messages', messagesIn)
		.on('mod_dialog', mod.dialog) 
		.on('room', function(r){
			if (locals.room.id!==r.id) {
				console.log('SHOULD NOT HAPPEN!');
			}
			locals.room = r;
			localStorage['successfulLoginLastTime'] = "yes";
			localStorage['room'] = locals.room.id;
			notif.updateTab(0, 0);
			$('#roomname').text(locals.room.name);
			var htmldesc = miaou.mdToHtml(locals.room.description);
			$('#roomdescription').html(htmldesc);
			$('#room-panel-bg').css('background-image',function(){
				var m = htmldesc.match(/^<img (?:href="?[^"> ]+"? )?src="?([^">]+)"?[^>]*>(<br>|$)/);
				return m ? 'url('+m[1]+')' : '';
			});
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
				socket.emit('enter', locals.room.id);
			}, 500); // first message after reconnect not always received by server if I don't delay it (todo : elucidate and clean)
		})
		.on('welcome', function(){
			info.state = 'connected';
			gui.entered = true;
			if (location.hash) md.focusMessage(+location.hash.slice(1));
			else gui.scrollToBottom();
			usr.showEntry(locals.me);
			if (watch.enabled) socket.emit('start_watch');
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
			notif.touch(0, true, invit.byname, 'You have been invited in a dialog room.');
			gui.scrollToBottom();
		})
		.on('pm_room', function(roomId){
			location = roomId;
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
		.on('pings', notif.pings)
		.on('rm_ping', notif.removePing)
		.on('disconnect', function(){ console.log('DISCONNECT') })
		.on('enter',usr.showEntry)
		.on('leave', usr.showLeave)
		.on('miaou.error', md.showError)
		.on('recent_users', function(users){
			users.forEach(function(user){ usr.insertAmongRecentUsers(user, user.md) });
		})
		.on('vote', md.applyVote)
		.on('wat', watch.add)
		.on('watch_incr', watch.incr)
		.on('watch_raz', watch.raz)
		.on('unwat', watch.remove)
		.on('error', function(err){
			// in case of a user having lost his rights, we don't want him to constantly try to connect
			socket.disconnect();
			console.log('ERROR', err);
			md.showError(err);
			md.showError("A fatal error occurred, you're disconnected from the server (you might try refreshing the page)");
		});
	}
});
