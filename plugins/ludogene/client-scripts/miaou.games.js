miaou(function(games, chat, ed, locals, md, ms, notif, plugins, ws){

	function send(m, game, verb, o){
		o = o || {};
		o.mid = m.id;
		ws.emit('ludo.'+verb, o);
	}

	function renderAsk($c, m, game){
		$c.empty();
		var	$p = $('<div>').addClass('game-proposal').appendTo($c),
			names = game.players.map(function(p){ return p.name });
		if (names[0]===locals.me.name) {
			$p.append("<i>"+game.players[1].name+"</i> wants to play a game of "+game.type+" with you. ");
			$('<button/>').text('Accept').click(function(){ send(m, game, "accept") }).appendTo($p);
		} else if (names[1]===locals.me.name) {
			$p.append("You proposed a game of "+game.type+" to <i>"+game.players[0].name+"</i>.");
		} else {
			$p.append("<i>"+names[1]+"</i> proposed a game of "+game.type+" to <i>"+names[0]+"</i>.");
		}
	}

	function renderRefused($c, m, game){
		$c.empty();
		var	$p = $('<div>').addClass('game-proposal').appendTo($c),
			names = game.players.map(function(p){ return p.name });
		$p.append("<i>"+names[0]+"</i> refused a game of "+game.type+" proposed by <i>"+names[1]+"</i>.");
	}

	// renders the message when it's in small or side containers
	function renderAbstract($c, m, game){
		$c.empty();
		if (game.status === "ask") {
			$c.text(game.type + ' not yet started');
			return;
		}
		if (game.status === "refused") {
			renderRefused($c, m, game);
			return;
		}
		if (!games[game.type]) return;
		games[game.type].render($c, m, game, true);
	}

	function renderHelp($c, game){
		var $helpDiv;
		$c.css('position', 'relative'); // <- fixme : find a less hacky solution than changing $c
		$('<div>?</div>').css({
			position:'absolute', top:0, left:0, height:'20px', width:'20px', borderRadius:'0 0 10px 0',
			paddingTop:'0px', paddingLeft:'7px', color:'white', fontWeight:'bold',
			background:'black', opacity:0.15, cursor:'pointer', zIndex:3
		}).appendTo($c).hover(
			function(){
				$helpDiv = $('<div/>').css({
					position:'absolute', top:0, left:0, height:'120px',
					right:'10px', borderRadius:'0 0 10px 0', zIndex:2
				}).appendTo($c.width()>300 ? $c : $c.closest('.message'));
				games[game.type].fillHelp($helpDiv);
			}, function(){
				$helpDiv.remove();
			}
		);
	}

	function renderMessage($c, m, game){
		if (!$c.closest('#messages,#mwin').length) return renderAbstract($c, m, game);
		if (game.status === "ask") return renderAsk($c, m, game);
		if (game.status === "refused") return renderRefused($c, m, game);
		var gt = games[game.type];
		if (!gt) return $c.text('Game type not available');
		gt.render($c, m, game);
		renderHelp($c, game);
		$c.closest('.message').find('.pen').remove();
	}

	function messageGame(m){
		if (!m.content) return;
		if (m.game) return m.game;
		var match = m.content.match(/!!game @\S{3,} (.*)$/);
		if (!match) return;
		try {
			return m.game = JSON.parse(match[1]);
		} catch (e) {
			console.log("not a game message");
		}
	}

	plugins.ludogene = {
		start: function(){
			ms.registerStatusModifier(function(message, status){
				var g = messageGame(message);
				if (g && g.moves) {
					status.editable = false;
					status.deletable = false;
					status.mod_deletable = false;
				}
			});
			md.registerRenderer(function($c, m){
				var g = messageGame(m);
				if (g) {
					renderMessage($c, m, g);
					return true;
				}
			});
			ws.on('ludo.move', function(arg){
				$('.mwintab[mid='+arg.mid+']').addClass('new');
				$('.message[mid='+arg.mid+']').each(function(){
					var	$message = $(this),
						m = $message.dat('message'),
						game = messageGame(m);
					if (!game) return;
					var playername = game.players[arg.move.p].name;
					if (
						games[game.type].move($message.find('.content'), m, game, arg.move)
						&& game.players[+!arg.move.p].id===locals.me.id
					) {
						notif.touch(m.id, true, playername, playername + ' made a move in your game');
					}
				});
			});
			ed.registerCommandArgAutocompleter("tribostats", ["games", "players", "matrix"]);
			ed.registerCommandArgAutocompleter("triboladder", function(ac){
				if (/^@\S{3,}$/.test(ac.previous)) return ["games", "opponents"];
			});
		}
	}
});
