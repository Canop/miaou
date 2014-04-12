(function(){

	function send(m, game, verb, o){
		o = o || {};
		o.mid = m.id;
		miaou.socket.emit('ludo.'+verb, o);
	}

	function renderAsk($c, m, game){
		var $p = $('<div>').addClass('game-proposal').appendTo($c);
		if (game.players[0].name===me.name) {
			$p.append("<i>"+game.players[1].name+"</i> wants to play a game of "+game.type+" with you. ");
			$('<button/>').text('Accept').click(function(){ send(m, game, "accept") }).appendTo($p);
		} else if (game.players[1].name===me.name) {
			$p.append("You proposed a game of "+game.type+" to <i>"+game.players[0].name+"</i>.");
		} else {
			$p.append("<i>"+game.players[1].name+"</i> proposed a game of "+game.type+" to <i>"+game.players[0].name+"</i>.");			
		}
		return true;
	}
	
	function renderMessage($c, m, game){
		if (game.status === "ask") renderAsk($c, m, game);
		else miaou.games[game.type].render($c, m, game);
	}
	
	miaou.chat.plugins.ludogene = {
		start: function(){
			miaou.md.registerRenderer(function($c, m){
				if (!m.content) return;
				var match = m.content.match(/^!!game @\S{3,} (.*)$/);
				if (!match) return;
				//~ try {
					renderMessage($c, m, JSON.parse(match[1]));
					return true;
				//~ } catch(e) {
					//~ console.log("Error in game rendering", e);
				//~ }
			});
			miaou.socket.on('ludo.move', function(arg){
				var $message = $('#messages .message[mid='+arg.mid+']');
				if (!$message.length) {
					console.log('message not visible');
					return;
				}
				var m = $message.data('message'),
					match = m.content.match(/^!!game @\S{3,} (.*)$/);
				if (!match) return;
				var game = JSON.parse(match[1]);
				miaou.games[game.type].move($message.find('.content'), m, game, arg.move);
			});
		}
	}
	
})();



