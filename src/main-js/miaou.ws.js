// ws : handles the connection to the server over socket.io (websocket whenever possible)

miaou(function(ws, chat, ed, gui, hist, locals, md, mod, notif, time, usr, watch){

	ws.init = function(){
		var	pingRegex = new RegExp('(^|\\s)@(room|here|'+locals.me.name+')\\b', 'i'),
			info = { state:'connecting', start:Date.now() },
			nbEntries = 0, // grows on disconnect+reconnect
			//lastReceptionTime, // ms since epoch
			socket = window.io.connect(location.origin);

		ws.emit = socket.emit.bind(socket);
		ws.on = function(eventType, fun){
			socket.on(eventType, function(arg){
				if (/connect/i.test(eventType)) {
					console.log("/connect/:", eventType, arg);
				}
				//lastReceptionTime = Date.now();
				fun(arg);
			});
		}

		function messagesIn(messages){
			var	visible = vis(),
				isAtBottom = gui.isAtBottom(),
				shouldStickToBottom = isAtBottom || info.state!=='connected',
				addedMD = [],
				lastMessageId,
				$lastMd;
			if (Array.isArray(messages)) {
				messages = messages.sort(function(m1, m2){ return m1.id-m2.id });
			} else {
				messages = [messages];
			}

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
				var ping = pingRegex.test(message.content) && message.author!=locals.me.id;
				if (message.id) {
					if (message.id>chat.lastMessageId) {
						chat.lastMessageId = lastMessageId = message.id;
						$lastMd = $md;
					}
					md.updateNotableMessage(message);
				}
				if (
					(message.id||ping) && time.isNew(message) && message.content
				) {
					notif.touch(message.id, ping, message.authorname, message.content, locals.room, $md);
				}
				addedMD.push($md);
			});
			addedMD.forEach(function($md){
				md.resize($md, shouldStickToBottom);
				md.resizeUser($md.siblings('.user'));
			});
			if (shouldStickToBottom && lastMessageId === chat.lastMessageId) {
				gui.scrollToBottom($lastMd);
			}
			md.updateLoaders();
			md.showMessageFlowDisruptions();
			if (typeof prettyPrint !== 'undefined') prettyPrint();
			hist.showPage();
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
			if (info.state === "entering" || info.state === "connected") {
				console.log("already " + info.state);
				return;
			}
			info.state = 'entering';
			// console.log("-> enter", entry);
			socket.emit("enter", entry);
		}

		socket
		.on('ready', function(){
			// console.log("<- ready");
			enter();
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
		.on('server_commands', function(commands){
			for (var key in commands) chat.commands[key] = commands[key];
			ed.registerCommandArgAutocompleter("help", Object.keys(commands));
		})
		.on('get_room', function(unhandledMessage){
			// this should be mostly useless now
			console.log("emitting enter in get_room");
			enter();
			if (unhandledMessage) socket.emit("message", unhandledMessage);
		})
		.on('message', messagesIn)
		.on('messages', messagesIn)
		.on('mod_dialog', mod.dialog)
		.on('room', function(r){
			if (locals.room.id!==r.id) {
				console.log('SHOULD NOT HAPPEN!');
				return;
			}
			locals.room = r;
			localStorage['successfulLoginLastTime'] = "yes";
			localStorage['room'] = locals.room.id;
			notif.updateTab(0, 0);
			$('#roomname').text(locals.room.name);
			var htmldesc = miaou.fmt.mdTextToHtml(
				locals.room.description.trim()||"*no description*",
				null,
				true
			);
			$('#room-description').html(htmldesc);
			$("#room-tags").empty().append(locals.room.tags.map(function(t){
				return $("<span class=tag>").text(t);
			}));
			$('#room-panel-bg, #room-area')
			.toggleClass("has-background-image", !!locals.room.img)
			.css('background-image', locals.room.img ? 'url("'+locals.room.img+'")' : 'none');
		})
		.on('box', md.box)
		.on('notables', function(notableMessages){
			md.showMessages(notableMessages, $('#notable-messages'));
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
			info.state = 'connected';
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
			$("#chat-loading").remove();
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
		.on('must_reenter', function(){
			console.log("<- must_reenter");
			info.state = 'must_reenter';
			enter();
		})
		.on('disconnect', function(){
			console.log("<- disconnect");
			info.state = 'disconnected';
			ws.notif.onOff();
		})
		.on('enter', usr.showEntry)
		.on('leave', usr.showLeave)
		.on('miaou.error', md.showError)
		.on('recent_users', function(users){
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
