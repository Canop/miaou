
miaou(function(chat, horn, links, locals, md, notif, gui, plugins, time, ws){
	
	chat.config = { // may be changed by server later
		maxMessageContentSize: 8000,
		minDelayBetweenMessages: 500,
		maxAgeForMessageEdition: 30,
		maxAgeForMessageTotalDeletion: 3*60,
	};
	chat.DELAY_BEFORE_PROFILE_POPUP= 300; // ms
	chat.DISRUPTION_THRESHOLD = 60*60; // seconds
	chat.commands = {}; // all known commands issued with !! (value=description)
	chat.voteLevels = [{key:'pin',icon:'&#xe813;'}, {key:'star',icon:'&#xe808;'}, {key:'up',icon:'&#xe800;'}, {key:'down',icon:'&#xe801;'}];

	var listeners = {};

	chat.start = function(){
		notif.init();
		horn.init();
		ws.init();
		links.init();
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
				if (delmatch[2]) h += ' on ' + time.formatTime(+delmatch[2].slice(3)); 
				$c.html(h).closest('.message').addClass('deleted');
				return true;
			}
			if (message.content) {
				$c.html(miaou.fmt[ $c.closest('#messages').length ? 'mdMcToHtml' : 'mdTextToHtml' ](
					message.content, message.authorname
				));
			} else {
				$c.empty();				
			}
		});
		locals.pluginsToStart.forEach(function(name){
			if (!plugins[name]) {
				console.log("Missing plugin : ", name);
				return;
			}
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
		notif.userAct();
	}
	
});
