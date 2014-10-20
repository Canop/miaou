
miaou(function(chat, md, ws, gui, plugins, ws){
	
	chat.config = { // may be changed by server later
		maxMessageContentSize: 8000,
		minDelayBetweenMessages: 500,
		maxAgeForMessageEdition: 30,
		maxAgeForMessageTotalDeletion: 3*60,
	};
	chat.DELAY_BEFORE_PROFILE_POPUP= 300; // ms
	chat.DISRUPTION_THRESHOLD = 60*60; // seconds
	chat.nbUnseenMessages = 0;
	chat.oldestUnseenPing = 0;
	chat.lastReceivedPing = 0;
	chat.timeOffset = 0;
	chat.enterTime = 0; // both in seconds since epoch, server time
	chat.commands = {}; // all known commands issued with !! (value=description)

	var listeners = {};

	chat.clearPings = function() {
		// clear the pings of the current room and ask for the ones of the other rooms
		ws.emit('clear_pings', chat.lastReceivedPing);
	}
	
	// pings : an array whose elements contains 
	//   room : id of the room
	//   roomname
	function makeCrossRoomPingsNotificationMessage(pings){
		md.notificationMessage(function($c, remove){
			var t = "You've been pinged in room";
			if (pings.length>1) t += 's';
			$('<span>').text(t).appendTo($c);
			pings.forEach(function(p){
				$c.append($('<button>').addClass('openroom').text(p.roomname).click(function(){
					window.open(p.room);
					if ($md.find('.openroom').length==1) remove();
					else $(this).remove();
				}))
			});

		});
	}

	chat.pings = function(pings){ // this is used for old pings, made when user wasn't connected
		if (pings.length) {
			pings.forEach(function(p){
				chat.oldestUnseenPing = Math.min(chat.oldestUnseenPing, p.first);
				chat.lastReceivedPing = Math.max(chat.lastReceivedPing, p.last);
			});
			makeCrossRoomPingsNotificationMessage(pings);
		}		
	}
	chat.ping = function(p){ // this is used for instant cross-room pings
		makeCrossRoomPingsNotificationMessage([{room:p.r.id, roomname:p.r.name}]);
		gui.touch(0, true, p.m.authorname, p.m.content, p.r);
	}
	
	chat.start = function(){
		vis(function(){
			if (vis()) {
				chat.clearPings();
				chat.nbUnseenMessages = 0;
				if (chat.oldestUnseenPing) {
					md.focusMessage(chat.oldestUnseenPing);
					chat.oldestUnseenPing = 0;
				}
				gui.updateTab(0, 0);
				$('#input').focus();
			}
		});
		setInterval(function(){
			if (vis()) chat.clearPings();
		}, 3*60*1000);
		ws.init();
		gui.init();
		md.registerRenderer(function($c, message, oldMessage){
			if (oldMessage && message.content===oldMessage.content && $c.text().length) return; // mainly to avoid removing boxed content
			if (!message.content) {
				$c.empty().closest('.message').addClass('deleted');
				return true;
			}
			var delmatch = message.content.match(/^!!deleted (by:\d+ )?(on:\d+ )?/);
			if (delmatch) {
				var h = '';
				if (delmatch[1]) h += ' by <a href=user/'+delmatch[1].slice(3)+' target=profile>an admin</a>'; 
				if (delmatch[2]) h += ' on ' + miaou.formatTime(+delmatch[2].slice(3)); 
				$c.html(h).closest('.message').addClass('deleted');
				return true;
			}
			$c.empty().append(message.content ? miaou.mdToHtml(message.content, !!$c.closest('#messages').length, message.authorname) : '')
		});
		pluginsToStart.forEach(function(name){
			plugins[name].start();
		});
	}	

	// Registers for an event ("incoming_message", "sending_message")
	// Callback is called with message as argument, and can change this message
	// Returning false prevents the operation
	chat.on = function(type, fun){
		if (!listeners[type]) listeners[type] = [];
		listeners[type].push(fun);
		return chat;
	}
	// removes a function from listeners
	chat.off = function(type, fun){
		if (!listeners[type]) return;
		listeners[type] = listeners[type].filter(function(f){ return f!==fun });
		return chat;
	}
	chat.trigger = function(type, message, context){
		if (!listeners[type]) return;
		for (var i=0; i<listeners[type].length; i++) {
			var r = listeners[type][i](message, context);
			if (r===false) return false;
		}
		return chat;
	}
	
	// Sends a message. Examples :
	//  - sending a new message : miaou.chat.sendMessage("hello");
	//  - sending a new message : miaou.chat.sendMessage({content:"hello"});
	//  - editing a message :     miaou.chat.sendMessage({id:33, content:"Hello"});
	// You can optionnally pass a second argument (context) which will be forwarded
	//   to event listeners
	chat.sendMessage = function(m, context){
		if (typeof m === "string") m = {content:m};
		var r = chat.trigger("sending_message", m, context);
		if (r!==false) ws.emit('message', m);
	}
	
});
