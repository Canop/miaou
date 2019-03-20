
miaou(function(chat, hist, horn, links, locals, md, notif, gui, plugins, skin, time, ws){

	chat.config = { // may be changed by server later
		maxMessageContentSize: 8000,
		minDelayBetweenMessages: 500,
		maxAgeForMessageEdition: 30,
		maxAgeForMessageTotalDeletion: 3*60,
	};
	chat.DELAY_BEFORE_PROFILE_POPUP= 400; // ms
	chat.DISRUPTION_THRESHOLD = 60*60; // seconds
	chat.commands = []; // names of commands available in the current room
	chat.voteLevels = [
		{key:'pin', icon:'&#xe810;'},	// fontello icon-pin
		{key:'star', icon:'&#xe805;'},	// fontello icon-star
		{key:'up', icon:'&#xe815;'},	// fontello icon-thumbs-up-alt
		{key:'down', icon:'&#xe816;'}	// fontello icon-thumbs-down-alt
	];
	chat.lastMessageId = 0;
	chat.state = 'connecting';

	var listeners = {};

	// Registers for an event
	// Supported event types:
	// * ready
	// * incoming_message
	// 	called with message as argument
	// * sending_message
	// 	called with message as argument
	// 	returning false prevents the sending
	// * incoming_user
	// 	called with user as argument
	// * leaving_user
	// 	called with user as argument
	//
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

	if (!locals.me) return;
	var pingRegex = new RegExp('(^|\\s)@(room|here|'+locals.me.name+')\\b', 'i');

	function renderMessage($c, message, oldMessage){
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
			// ping and reply colorization
			// optm: the following calls to css provoke reflows...
			$c.find('.ping').css('border-color', function(){
				return skin.stringToColour(this.textContent.trim().slice(1));
			});
			$c.find('.reply').css('border-color', function(){
				return skin.stringToColour(this.getAttribute("rn"));
			});
			// apply content rating classes from content tags
			if (!gui.mobile) {
				if (/(?:^|\s)#nsfw\b/i.test(message.content)) $c.addClass('content-rating-nsfw');
				if (/(?:^|\s)#not-serious\b/i.test(message.content)) $c.addClass('content-rating-not-serious');
			}
		} else {
			$c.empty();
		}
	};

	chat.messagesIn = function(messages){
		var	visible = vis(),
			isAtBottom = gui.isAtBottom(),
			shouldStickToBottom = isAtBottom || chat.state!=='connected',
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
			if (message.room !== locals.room.id) {
				console.log("message of other room not displayed", message);
				return;
			}
			if (shouldStickToBottom && !visible) {
				var $lastSeen = $('#messages .rvis').last();
				if ($lastSeen.length) {
					if ($lastSeen.offset().top<10) shouldStickToBottom = false;
				}
			}
			var $md = md.addMessage(message, shouldStickToBottom);
			$md.addClass(visible||chat.state!=='connected' ? 'rvis' : 'rnvis');
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

	chat.start = function(){
		notif.init();
		horn.init();
		ws.init();
		links.init();
		gui.init();
		md.registerRenderer(renderMessage);
		md.startAutoCleaner();
		plugins.start();
		gui.setRoom(locals.room);
		if (locals.messages) chat.messagesIn(locals.messages);
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
		notif.userAct();
		if (r===false) return false;
		ws.emit('message', m);
	}

});
