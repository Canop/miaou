// ==UserScript==
// @namespace        http://dystroy.org/miaou
// @name             MiaouBotSample
// @author           dystroy
// @version          0.1
// @run-at           document-end
// @match            http://127.0.0.1:8204/* 
// @match            http://localhost:8204/* 
// @match            http://dystroy.org/miaou/* 
// ==/UserScript==

// This sample bot lives in your browser using your account. It does 3 things :
//  - it sometimes pongs when you're pinged
//  - if echoes any text in a message starting with "echo "
//  - it prettifies the short messages you send
//
// This bot isn't meant for direct use but as a basis and doc for your own bots.
// Now... Please test your bots in a room where you wouldn't disturb other users.

var code = function(){
	
	if (!miaou || !miaou.chat) return;

	var IAmPingedRegex = new RegExp('@'+me.name+'(\\s|$)');
	// when a message comes in, let's handle it
	miaou.chat.on('incoming_message', function(m){
		if (!miaou.time.isNew(m)) return; // we only handle new messages
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

	var deco = ['','*','**','***','---','`'];
	// when a message is sent by the host user, let's make it prettier
	miaou.chat.on('sending_message', function(m){
		if (/^\w[^@\n`*\/]*$/.test(m.content)) { // be careful : not everything "should" be prettyfied
			m.content = m.content.split(' ').map(function(t, b){
				return b = deco[Math.random()*deco.length|0], b+t+b;
			}).join(' ');
		}
	});

}
	
var script = document.createElement('script');
script.textContent = '(' + code + ')()';
(document.head||document.documentElement).appendChild(script);
script.parentNode.removeChild(script);
