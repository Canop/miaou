// Games are stored in JSON in messages
// A valid game (even before accept) is always stored like this :
// maybeAPingOrReply !!game @otherPlayer jsonEncodedGame
// The state of a game isn't sent at each move : clients update it themselves using the moves
var	cache = require('bounded-cache')(300),
	tribostats = require('./tribostats.js');
	elo = require('./elo.js');

var gametypes = {
	Tribo: require('./client-scripts/Tribo.js'),
	Flore: require('./client-scripts/Flore.js')
};


// returns a bound promise opening a connection to the db
//  and returning both the message and the game whose id is passed
// The caller **must** end the promise chain with off
function dbGetGame(shoe, mid){
	return shoe.db.on().then(function(){
		return cache.get(mid) || this.getMessage(mid).then(function(m){
			var	json = m.content.match(/!!game @\S{3,} (.*)$/)[1],
				g = JSON.parse(json);
			m.room = shoe.room.id; // db.getMessage doesn't provide the room, we must set it before saving
			gametypes[g.type].restore(g);
			var data = [m, g];
			cache.set(mid, data);
			return data;
		});
	});
}

// serializes the game in the message and asynchronously notifies observers
function storeInMess(m, game, shoe){
	var	saved = {type:game.type, status:game.status, players:game.players},
		gametype = gametypes[game.type];
	if (game.scores) saved.scores = game.scores;
	if (game.current>=0) saved.current = game.current; // current is -1, 0 or 1
	gametype.store(game, saved);
	m.content = m.content.match(/^(.*?)!!/)[1] + "!!game @"+game.players[0].name+" "+JSON.stringify(saved);
	m.changed = 0;
	if (gametype.observers) {
		 // warning : at this point it's still possible the message has no id
		 // we should provide a way for the observer to be notified after the message has been saved
		gametype.observers.forEach(function(fun){
			setTimeout(fun, 200, m, game, shoe);
		});
	}
}

function onCommand(ct){
	var	m = ct.message,
		cmd = ct.cmd.name,
		shoe = ct.shoe,
		match = ct.args.match(/^@(\w[\w_\-\d]{2,})/);
	if (!match) throw 'Bad syntax. Use `!!'+cmd+' @yourOpponent`';
	if (match[1]===shoe.publicUser.name) throw "You can't play against yourself";
	storeInMess(m, {
		players: [
			{name:match[1]}, // id will be resolved later
			{id:m.author, name:m.authorname}
		],
		type: cmd==='game' ? 'Tribo' : cmd[0].toUpperCase()+cmd.slice(1),
		status:'ask'
	}, shoe);
}

exports.accept = function(shoe, arg, accepter){
	dbGetGame(shoe, arg.mid).spread(function(m, game){
		game.players[0].id = (accepter||shoe.publicUser).id;
		game.status = 'running';
		m.changed = Date.now()/1000|0;
		storeInMess(m, game, shoe);
		return this.storeMessage(m, true);
	}).then(function(m){
		shoe.emitToRoom('message', m);
	}).finally(shoe.db.off);
}

exports.move = function(shoe, arg){
	dbGetGame(shoe, arg.mid).spread(function(m, game){
		var gametype = gametypes[game.type],
			move = gametype.decodeMove(arg.move);
		if (gametype.isValid(game, move)) {
			game.moves += arg.move;
			gametype.apply(game, move);
			shoe.emitToRoom('ludo.move', {mid:m.id, move:move});
			storeInMess(m, game ,shoe);
			m.changed = Date.now()/1000|0;
			return this.storeMessage(m, true);
		} else {
			console.log('ludo : illegal move', move);
		}
	}).finally(shoe.db.off);
}

exports.onNewShoe = function(shoe){
	shoe.socket
	.on('ludo.accept', function(arg){ exports.accept(shoe, arg) })
	.on('ludo.move', function(arg){ exports.move(shoe, arg) });
}

// Checking the message isn't a started game
// We just check the cache right now, which isn't 100% secure
exports.onChangeMessage = function(shoe, m){
	var data = cache.peek(m.id);
	if (!data) return;
	if (data[1].moves) return "A started game can't be rewritten or deleted";
}

exports.registerCommands = function(cb){
	//cb('game', onCommand, "propose a random game. Type `!!game @somebody`");
	cb({
		name:'tribo', fun:onCommand,
		help:"propose a game of Tribo. Type `!!tribo @somebody`"
	});
	cb({
		name:'tribostats', fun:tribostats.onCommand,
		help:"compute Tribo related stats for the room. Type `!!tribostats [games|players|twc|twc-final|matrix]`"
	});
	cb({
		name:'triboladder', fun:elo.onCommand,
		help:"compute an ELO based global Tribo ladder"
	});
}

exports.registerGameObserver = function(type, cb){
	var gt = gametypes[type];
	if (!gt.observers) gt.observers = [];
	gt.observers.push(cb);
}

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
