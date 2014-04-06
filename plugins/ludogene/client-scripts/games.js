(function(){

	function send(m, game, verb, o){
		o = o || {};
		o.mid = m.id;
		miaou.socket.emit('ludo.'+verb, o);
	}

	function renderAsk(m, game){
		var $p = $('<div>').addClass('game-proposal');
		if (game.players[0].name===me.name) {
			$p.append("<i>"+game.players[1].name+"</i> wants to play a game of "+game.type+" with you. ");
			$('<button/>').text('Accept').click(function(){ send(m, game, "accept") }).appendTo($p);
		} else if (game.players[1].name===me.name) {
			$p.append("You proposed a game of "+game.type+" to <i>"+game.players[0].name+"</i>.");
		} else {
			$p.append("<i>"+game.players[1].name+"</i> proposed a game of "+game.type+" to <i>"+game.players[0].name+"</i>.");			
		}
		return $p;
	}
	
	function renderMessage(m, game){
		console.log(game);
		if (game.status === "ask") return renderAsk(m, game);
		else return "hop";
	}
	
	miaou.chat.plugins.ludogene = {
		start: function(){
			miaou.md.registerRenderer(function(m){
				var match = m.content.match(/^!!game @\S{3,} (.*)$/);
				if (!match) return;
				try {
					return renderMessage(m, JSON.parse(match[1]));
				} catch(e) {
					console.log("Error in game rendering", e);
				}
			});
		}
	}
	
})();



