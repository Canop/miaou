// Games are stored in JSON in messages
// A valid game (even before accept) is always stored like this :
// maybeAPingOrReply !!game @otherPlayer jsonEncodedGame
// The state of a game isn't sent at each move : clients update it themselves using the moves

const	Promise = require("bluebird"),
	cache = require('bounded-cache')(300),
	suggest = require('./suggest.js'),
	tournament = require('./tournament.js'),
	tribostats = require('./tribostats.js'),
	elo = require('./elo.js'),
	badges = require('./badges.js');

var	db,
	rooms,
	ws,
	bot;

var gametypes = {
	Tribo: require('./client-scripts/Tribo.js'),
	Flore: require('./client-scripts/Flore.js'),
};

exports.init = async function(miaou){
	bot = miaou.bot;
	db = miaou.db;
	rooms = miaou.lib("rooms");
	ws = miaou.lib("ws");
	tournament.init(miaou);
	elo.init(miaou, gametypes);
	setTimeout(function(){
		require('./db.js').cleanOldInvitations(db, 5*24*60*60);
	}, 15*60*1000);
	setTimeout(function(){
		require('./db.js').cleanOldForgottenGames(db, 30*24*60*60);
	}, 5*60*1000);
	await miaou.requestTag({
		name: "Tribo",
		description: "The Bestest Game.\nInvite a player with\n\t!!tribo @username"
	});
	await miaou.requestTag({
		name: "Flore",
		description: "A game with flowers (in development).\nInvite a player with\n\t!!flore @username"
	});
	await badges.init(miaou);
}

// returns a bound promise opening a connection to the db
//  and returning both the message and the game whose id is passed
// The caller **must** end the promise chain with off
function dbGetGame(mid){
	return db.on().then(function(){
		return cache.get(mid) || this.getMessage(mid).then(function(m){
			var	json = m.content.match(/!!game @\S{3,} (.*)$/)[1],
				g = JSON.parse(json);
			gametypes[g.type].restore(g);
			var data = [m, g];
			cache.set(mid, data);
			return data;
		});
	});
}

function newGame(type, players){
	var	gametype = gametypes[type],
		g = { type, status:'ask', players };
	if (!gametype) throw "unknown game type: "+type;
	if (gametype.init) gametype.init(g);
	gametype.restore(g);
	return g;
}

exports.startGame = function(roomId, type, players, running){
	var	players = players.map(function(p){
		var gp = {name:p.name};
		if (p.id) gp.id = p.id;
		return gp;
	});
	var	game = newGame(type, players);
	var	content = '!!game @' + players[0].name + " " + JSON.stringify(game);
	var	gametype = gametypes[type];
	return new Promise(function(resolve){
		ws.botMessage(bot, roomId, content, function(m){
			resolve(m);
			if (gametype.observers) {
				gametype.observers.forEach(function(fun){
					setTimeout(fun, 1500, m, game);
				});
			}
		});
	})
}

// serializes the game in the message and asynchronously notifies observers
function storeInMess(m, game){
	var	saved = {type:game.type, status:game.status, players:game.players},
		gametype = gametypes[game.type];
	if (game.scores) saved.scores = game.scores;
	if (game.current>=0) saved.current = game.current; // current is -1, 0 or 1
	gametype.store(game, saved);
	m.content = m.content.match(/^(.*?)!!/)[1] + "!!game @"+game.players[0].name + " " + JSON.stringify(saved);
	m.changed = 0;
	if (gametype.observers) {
		// warning : at this point it's still possible the message has no id
		// we should provide a way for the observer to be notified after the message has been saved
		gametype.observers.forEach(function(fun){
			setTimeout(fun, 500, m, game);
		});
	}
}


function onCommand(ct){
	var	m = ct.message,
		cmd = ct.cmd.name,
		shoe = ct.shoe,
		gameType = cmd==='game' ? 'Tribo' : cmd[0].toUpperCase()+cmd.slice(1),
		match = ct.args.match(/^@(\w[\w_\-\d]{2,})/);
	if (!match) {
		if (/tournament/i.test(ct.args)) {
			return tournament.handle.call(this, ct, gameType);
		}
		return suggest.call(this, ct, gameType);
	}
	var otherUserName = match[1];
	if (shoe.room.tags.includes("Tournament")) {
		throw "You can't propose a game in a Tournament room";
	}
	if (otherUserName===shoe.publicUser.name) throw "You can't play against yourself (you would lose anyway)";
	return this.getUserByName(otherUserName).then(function(otherUser){
		if (!otherUser) throw "User @"+otherUserName+" not found";
		storeInMess(m, newGame(gameType, [
			{name:otherUserName}, // id will be resolved later
			{id:m.author, name:m.authorname}
		]));
		ct.end();
	});
}

function onBotCommand(cmd, args, bot, m){
	var	gameType = cmd.name==='game' ? 'Tribo' : cmd.name[0].toUpperCase()+cmd.name.slice(1),
		match = args.match(/^@(\w[\w_\-\d]{2,})/);
	if (!match) {
		console.log("wrong command from a bot", m);
		return;
	}
	storeInMess(m, newGame(gameType, [
		{name:match[1]}, // id will be resolved later
		{id:bot.id, name:bot.name}
	]));
}

exports.accept = function(mid, accepter){
	dbGetGame(mid).spread(function(m, game){
		game.players[0].id = accepter.id;
		game.status = 'running';
		m.changed = Date.now()/1000|0;
		storeInMess(m, game);
		return this.storeMessage(m, true);
	}).then(function(m){
		ws.emitToRoom(m.room, 'message', m);
	}).finally(db.off);
}

// must be called with context a connected db
function pingOpponents(move, game, message){
	var	player = game.players[move.p],
		opponents = game.players.filter((_, i) => i!==move.p);
	opponents.forEach(opponent=>{
		ws.pingUser.call(
			this,
			message.room, opponent.name, message.id, player.name,
			player.name + " made a move"
		);
	});
}

exports.move = function(mid, encodedMove){
	dbGetGame(mid).spread(function(m, game){
		var	gametype = gametypes[game.type],
			move = gametype.decodeMove(encodedMove);
		if (gametype.isValid(game, move)) {
			game.moves += encodedMove;
			gametype.apply(game, move);
			storeInMess(m, game);
			ws.emitToRoom(m.room, 'ludo.move', {mid:m.id, move:move});
			m.changed = Date.now()/1000|0;
			rooms.updateMessage(m);
			return this.storeMessage(m, true).then(function(m){
				return pingOpponents.call(this, move, game, m);
			});
		} else {
			console.log('ludo : illegal move', move);
		}
	}).finally(db.off);
}

exports.onNewShoe = function(shoe){
	shoe.socket
	.on('ludo.accept', function(arg){
		exports.accept(arg.mid, shoe.publicUser)
	})
	.on('ludo.move', function(arg){
		exports.move(arg.mid, arg.move)
	});
}

// Checking the modified message isn't a started game
// We just check the cache right now, which isn't 100% secure
exports.onReceiveMessage = function(shoe, m){
	if (!m.id) return;
	var data = cache.peek(m.id);
	if (!data) return;
	if (data[1].moves) return "A started game can't be rewritten or deleted";
}

exports.registerCommands = function(cb){
	//cb('game', onCommand, "propose a random game. Type `!!game @somebody`");
	cb({
		name:'tribo', fun:onCommand, botfun:onBotCommand,
		help:"propose a game of Tribo. Type `!!tribo @somebody`"
	});
	cb({
		name:'flore', fun:onCommand, botfun:onBotCommand,
		help:"propose a game of Flore. Type `!!flore @somebody`"
	});
	cb({
		name:'tribostats', fun:tribostats.onCommand,
		help:"compute Tribo related stats for the room. Type `!!tribostats [games|players|matrix]`"
	});
	cb({
		name:'triboladder', fun:elo.onCommand,
		help:"compute an ELO based global Tribo ladder",
		detailedHelp:"Examples:"+
			"\n* `!!triboladder`: global ladder"+
			"\n* `!!triboladder @someuser`: ladder for a specific user"+
			"\n* `!!triboladder @someuser games`: all games and details of the Elo computation"+
			"\n* `!!triboladder @someuser opponents`: opponents and numbers of games"
	});
	cb({
		name:'floreladder', fun:elo.onCommand,
		help:"compute an ELO based global Flore ladder",
		detailedHelp:"Examples:"+
			"\n* `!!floreladder`: global ladder"+
			"\n* `!!floreladder @someuser`: ladder for a specific user"
	});
}

exports.registerGameObserver = function(type, cb){
	var gt = gametypes[type];
	if (!gt.observers) gt.observers = [];
	gt.observers.push(cb);
}

// This function is just on for a temporary time.
// Its goal is to let the AI see games again when some of them
// were forgotten
exports.onSendMessage = function(shoe, m, send){
	if (/^!!game /.test(m.content)) {
		var match = m.content.match(/!!game @\S{3,} (.*)$/);
		if (match) {
			let	g = JSON.parse(match[1]),
				gametype = gametypes[g.type];
			if (gametype && gametype.observers && g.status !== "finished") {
				console.log("re-observing game ", m.id);
				gametype.restore(g);
				gametype.observers.forEach(function(fun){
					setTimeout(fun, 200, m, g);
				});
			}
		}
	}
}

