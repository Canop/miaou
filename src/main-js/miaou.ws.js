// ws : handles the connection to the server over socket.io (websocket whenever possible)

miaou(function(ws, chat, ed, gui, hist, locals, md, mod, notif, prefs, time, usr, watch){

	ws.init = function(){
		var	nbEntries = 0, // grows on disconnect+reconnect
			socket = window.io.connect(location.origin);

		ws.emit = socket.emit.bind(socket);
		ws.on = function(eventType, fun){
			socket.on(eventType, function(arg){
				if (/connect/i.test(eventType)) {
					console.log("/connect/:", eventType, arg);
				}
				fun(arg);
			});
		}

		function enter(){
			var entry = {
				roomId: locals.room.id,
				nbEntries: nbEntries,
				tzoffset: (new Date).getTimezoneOffset()
			};
			if (nbEntries++) {
				console.log("preparing RE-entry");
				entry.lastMessageSeen = $("#messages .message").map(function(){
					return +this.getAttribute("mid");
				}).get().filter(Number).pop();
			}
			if (chat.state === "entering" || chat.state === "connected") {
				console.log("already " + chat.state);
				return;
			}
			chat.state = 'entering';
			console.log("-> enter", entry);
			socket.emit("enter", entry);
		}

		socket
		.on('ready', function(){
			setTimeout(function(){
				console.log("<- ready");
				enter();
			}, 0);
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
		.on('set_enter_time', time.setRoomEnterTime)
		.on('server_commands', function(commandNames){
			chat.commands = commandNames;
			ed.registerCommandArgAutocompleter("help", commandNames);
		})
		.on('get_room', function(unhandledMessage){
			// this should be mostly useless now
			console.log("emitting enter in get_room");
			enter();
			if (unhandledMessage) socket.emit("message", unhandledMessage);
		})
		.on('message', chat.messagesIn)
		.on('messages', chat.messagesIn)
		.on('mod_dialog', mod.dialog)
		.on('room', function(r){
			if (locals.room.id!==r.id) {
				console.log('SHOULD NOT HAPPEN!');
				return;
			}
			gui.setRoom(r);
		})
		.on('box', md.box)
		.on('notables', function(notableMessages){
			md.showSideMessages(notableMessages, $('#notable-messages'));
		})
		.on('notableIds', md.updateNotableMessages)
		.on('request', md.showRequestAccess)
		.on('request_outcome', function(ar){
			watch.incrRequests(ar.room, -1);
		})
		.on('reconnect', function(){
			console.log("<- reconnect");
			$("#notifications").empty(); // why ?
			ws.notif.onOn();
			enter();
		})
		.on('welcome', function(){
			// console.log("<- welcome");
			chat.state = 'connected';
			gui.entered = true;
			gui.scrollToBottom();
			var m = location.hash.match(/^#?(\d+)$/);
			if (m) {
				md.focusMessage(+m[1]);
				location.hash = '';
			} else if (localStorage.destMessage) {
				md.focusMessage(+localStorage.destMessage);
				delete localStorage.destMessage;
			}
			usr.showEntry(locals.me);
			if (watch.enabled) socket.emit('start_watch');
			notif.userAct();
			$("#chat-connecting").addClass("hiding");
			setTimeout(function(){
				$("#chat-connecting").remove();
			}, 5000);
			console.log("trigger ready");
			chat.trigger("ready");
		})
		.on('invitation', function(invit){
			var $md = $('<div>').html(
				'You have been invited by <span class=user>'+invit.byname+'</span> in a private lounge.'
			).addClass('notification').append(
				$('<button>').addClass('openroom').text('Enter room').click(function(){
					location = invit.room;
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
		.on('found', hist.found)
		.on('hist', hist.showHist)
		.on('pings', notif.pings)
		.on('rm_ping', notif.removePing)
		.on('rm_pings', notif.removePings)
		.on('cmd_pref', prefs.handleCmdPref)
		//.on('prefs', prefs.setMergedPrefs) // not used today
		.on('must_reenter', function(){
			console.log("<- must_reenter");
			chat.state = 'must_reenter';
			enter();
		})
		.on('must_reload', function(){
			location.reload();
		})
		.on('disconnect', function(){
			console.log("<- disconnect");
			chat.state = 'disconnected';
			ws.notif.onOff();
		})
		.on('enter', usr.showEntry)
		.on('leave', usr.showLeave)
		.on('miaou.error', md.showError)
		.on('recent_users', function(users){
			console.log('recent_users:', users);
			users.forEach(function(user){ usr.insertAmongRecentUsers(user, user.md) });
		})
		.on('vote', md.applyVote)
		.on('wat', watch.add)
		.on('watch_incr', watch.incr)
		.on('watch_raz', watch.raz)
		.on('watch_started', function(){
			// console.log("<- watch_started");
			watch.started();
		})
		.on('unwat', watch.remove)
		.on('error', function(err){
			// in case of a user having lost his rights, we don't want him to constantly try to connect
			console.log('ERROR', err);
			console.log("A fatal error occurred, you're disconnected from the server");
			socket.disconnect();
		});
	}
});
