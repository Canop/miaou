// ==UserScript==
// @namespace		http://dystroy.org/miaou
// @name            MiaouBotSample
// @author          dystroy
// @version         0.1
// @run-at          document-end
// @match			http://127.0.0.1:8204/* 
// @match			http://localhost:8204/* 
// @match			http://dystroy.org/miaou/* 
// ==/UserScript==

var code = function(){
	
	if (!miaou || !miaou.chat) return;

	var IAmPingedRegex = new RegExp('@'+me.name+'(\\b|$)');
	// when a message comes in, let's handle it
	miaou.chat.on('incoming_message', function(m){
		if (!(m.created > miaou.chat.enterTime)) return; // we only handle new messages
		if (IAmPingedRegex.test(m.content) && m.author!==me.id) {
			// we've been pinged, let's pong, maybe
			var delay = 5000*Math.random();
			if (delay > 2000) setTimeout(function(){
				miaou.chat.sendMessage("@"+m.authorname+"#"+m.id+" "+(~m.content.indexOf("pong") ? "ping" : "pong!"));
			}, delay);
		} else if (/^echo [^\n]+$/.test(m.content)) {
			// somebody wants us to repeat, let's do it
			miaou.chat.sendMessage(m.authorname + " says\n> " + m.content.slice("echo ".length));
		}
	});

	var deco = ['','*','**','***','---','`',' '];
	// when a message is sent by the host user, let's make it prettier
	miaou.chat.on('sending_message', function(m){
		if (/^\w[^\n`*\/]*$/.test(m.content)) {
			m.content = m.content.split(' ').map(function(t, b){
				return b = deco[~~(Math.random()*deco.length)], b+t+b;
			}).join(' ');
		}
	});

	// Now... Please test your bots in room where you won't disturb everybody ^^
}
	
var script = document.createElement('script');
script.textContent = '(' + code + ')()';
(document.head||document.documentElement).appendChild(script);
script.parentNode.removeChild(script);
