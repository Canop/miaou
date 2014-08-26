var miaou = miaou || {};

miaou.chat = {
	MAX_AGE_FOR_EDIT: 5000, // seconds TODO get it from server
	DELAY_BEFORE_PROFILE_POPUP: 300, // ms
	DISRUPTION_THRESHOLD: 60*60, // seconds
	nbUnseenMessages: 0, oldestUnseenPing: 0, lastReceivedPing: 0,
	timeOffset: 0, enterTime: 0, // both in seconds since epoch, server time
	plugins: [], // some might be unactive
	commands: {} // all known commands issued with !! (value=description)
};

(function(chat){
	
	chat.clearPings = function() {
		// clear the pings of the current room and ask for the ones of the other rooms
		miaou.socket.emit('clear_pings', miaou.chat.lastReceivedPing);
	}
	
	// pings : an array whose elements contains 
	//   room : id of the room
	//   roomname
	function makeCrossRoomPingsNotificationMessage(pings){
		var h = "You've been pinged in room";
		if (pings.length>1) h += 's';
		var $md = $('<div>').html(h).addClass('notification').appendTo('#messages');
		pings.forEach(function(p){
			$md.append($('<button>').addClass('openroom').text(p.roomname).click(function(){
				window.open(p.room);
				if ($md.find('.openroom').length==1) $md.remove();
				else $(this).remove();
			}))
		});
		$md.append($('<button>').addClass('remover').text('X').click(function(){ $md.remove() }));
		miaou.md.scrollToBottom();
	}
	
	chat.pings = function(pings){ // this is used for old pings, made when user wasn't connected
		if (pings.length) {
			pings.forEach(function(p){
				miaou.chat.oldestUnseenPing = Math.min(miaou.chat.oldestUnseenPing, p.first);
				miaou.chat.lastReceivedPing = Math.max(miaou.chat.lastReceivedPing, p.last);
			});
			makeCrossRoomPingsNotificationMessage(pings);
		}		
	}
	chat.ping = function(p){ // this is used for instant cross-room pings
		makeCrossRoomPingsNotificationMessage([{room:p.r.id, roomname:p.r.name}]);
		miaou.touch(0, true, p.m.authorname, p.m.content, p.r);
	}
	


	chat.start = function(){		
		var md = miaou.md;
		$(function(){
			vis(function(){
				if (vis()) {
					chat.clearPings();
					chat.nbUnseenMessages = 0;
					if (chat.oldestUnseenPing) {
						md.focusMessage(chat.oldestUnseenPing);
						chat.oldestUnseenPing = 0;
					}
					miaou.updateTab(0, 0);
					$('#input').focus();
				}
			});
			setInterval(function(){
				if (vis()) chat.clearPings();
			}, 3*60*1000);
			miaou.startChatWS();
			miaou.bindChatGui();
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
				chat.plugins[name].start();
			});
		});
	}
	
	var listeners = {};

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
		if (r!==false) miaou.socket.emit('message', m);
	}

})(miaou.chat);
