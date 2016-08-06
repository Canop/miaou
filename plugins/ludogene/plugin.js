// Games are stored in JSON in messages
// A valid game (even before accept) is always stored like this :
// maybeAPingOrReply !!game @otherPlayer jsonEncodedGame
// The state of a game isn't sent at each move : clients update it themselves using the moves
const	cache = require('bounded-cache')(300),
	suggest = require('./suggest.js'),
	tournament = require('./tournament.js'),
	tribostats = require('./tribostats.js'),
	rooms = require('../../libs/rooms.js'),
	ws = require('../../libs/ws.js'),
	elo = require('./elo.js');

var	db,
	bot;

var gametypes = {
	Tribo: require('./client-scripts/Tribo.js'),
};

exports.init = function(miaou, pluginpath){
	bot = miaou.bot;
	db = miaou.db;
	tournament.init(miaou);
	setTimeout(function(){
		require('./db.js').cleanOldInvitations(db, 50*24*60*60);
	}, 5*60*1000);
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


exports.startGame = function(roomId, type, players, running){
	var	gametype = gametypes[type],
		game = { type:type, status:running?"running":"ask"};
	if (!gametype) throw "unknown game type: "+type;
	game.players = players.map(function(p){
		var gp = {name:p.name};
		if (p.id) gp.id = p.id;
		return gp;
	});
	var	content = '!!game @' + players[0].name + " " + JSON.stringify(game);
	ws.botMessage(bot, roomId, content, function(m){
		if (gametype.observers) {
			gametype.observers.forEach(function(fun){
				setTimeout(fun, 1500, m, game);
			});
		}
	});
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
	if (/\[Tournament\]/i.test(shoe.room.description)) {
		throw "You can't propose a game in a Tournament room";
	}
	if (otherUserName===shoe.publicUser.name) throw "You can't play against yourself";
	return this.getUserByName(otherUserName).then(function(otherUser){
		if (!otherUser) throw "User @"+otherUserName+" not found";
		storeInMess(m, {
			players: [
				{name:otherUserName}, // id will be resolved later
				{id:m.author, name:m.authorname}
			],
			type: gameType,
			status:'ask'
		});
	});
}

function onBotCommand(cmd, args, bot, m){
	var	gameType = cmd.name==='game' ? 'Tribo' : cmd.name[0].toUpperCase()+cmd.name.slice(1),
		match = args.match(/^@(\w[\w_\-\d]{2,})/);
	if (!match) {
		console.log("wrong command from a bot", m);
		return;
	}
	storeInMess(m, {
		players: [
			{name:match[1]}, // id will be resolved later
			{id:bot.id, name:bot.name}
		],
		type: gameType,
		status:'ask'
	});
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

// todo: for a greater security we should pass a checked playerId
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
			return this.storeMessage(m, true);
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
		name:'tribostats', fun:tribostats.onCommand,
		help:"compute Tribo related stats for the room. Type `!!tribostats [games|players|twc|twc-final|matrix]`"
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
}

exports.registerGameObserver = function(type, cb){
	var gt = gametypes[type];
	if (!gt.observers) gt.observers = [];
	gt.observers.push(cb);
}

// This function is just on for a temporary time.
// Its goal is to let the AI see games again when some of them
// were forgotten
// exports.onSendMessage = function(shoe, m, send){
// 	if (/^!!game /.test(m.content)) {
// 		var match = m.content.match(/!!game @\S{3,} (.*)$/);
// 		if (match) {
// 			let	g = JSON.parse(match[1]),
// 				gametype = gametypes[g.type];
// 			if (gametype && gametype.observers && g.status !== "finished") {
// 				console.log("re-observing game ", m.id);
// 				gametype.restore(g);
// 				gametype.observers.forEach(function(fun){
// 					setTimeout(fun, 200, m, g);
// 				});
// 			}
// 		}
// 	}
// }

// This function is just on for a temporary time.
// Its goal is to cure messages containing games with the old saving format
// This part will be removed as soon as I've cured enough messages
/*
exports.onSendMessage = function(shoe, m, send){
	if (/^!!game /.test(m.content)) {
		var match = m.content.match(/!!game @\S{3,} (.*)$/);
		if (match) {
			g = JSON.parse(match[1]);
			var mustBeCured = g.status!=="ask" && !g.scores; // old format, we must resave it to ensure consistency
			console.log("game", m.id, "must be cured : ", mustBeCured);
			if (mustBeCured) {
				m.room = shoe.room.id;
				gametypes[g.type].restore(g);
				storeInMess(m, g, shoe);
				shoe.db.on().then(function(){
					return this.storeMessage(m, true);
				}).finally(shoe.db.off);
			}
		}
	}
}
*/
