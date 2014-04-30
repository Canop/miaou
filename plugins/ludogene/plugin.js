// Games are stored in JSON in messages
// A valid game (even before accept) is always stored like this :
//  !!game @otherPlayer jsonEncodedGame
// The state of a game isn't sent at each move : clients update it themselves using the moves
// TODO really prevent deletion/edition of games
var cache = require('bounded-cache')(200);

var gametypes = {
	Tribo: require('./client-scripts/Tribo.js'),
	Flore: require('./client-scripts/Flore.js')
};

// returns a bound promise opening a connection to the db
//  and returning both the message and the game whose id is passed
// The caller **must** end the promise chain with off
function dbGetGame(shoe, mid){
	return shoe.db.on(mid).then(function(){
		var data = cache.get(mid);
		return cache.get(mid) || this.getMessage(mid).then(function(m){
			var g = JSON.parse(m.content.split(' ')[2]);
			m.room = shoe.room.id; // db.getMessage doesn't provide the room, we must set it before saving
			gametypes[g.type].restore(g);
			data = [m, g];
			cache.set(mid, data);
			return data;
		});
	});
}

function storeInMess(m, game){
	var saved = {type:game.type, status:game.status, players:game.players};
	gametypes[game.type].store(game, saved);
	m.content = "!!game @"+game.players[0].name+" "+JSON.stringify(saved);
	delete m.changed;
}

function onCommand(cmd, shoe, m){
	var match = m.content.match(/^!!(\w+)\s+@(\w[\w_\-\d]{2,})\s*$/);
	if (match) {
		if (match[2]===shoe.publicUser.name) throw "You can't play against yourself";
		storeInMess(m, {
			players: [
				{name:match[2]}, // id will be resolved later
				{id:m.author, name:m.authorname}
			],
			type: cmd==='game' ? 'Tribo' : cmd[0].toUpperCase()+cmd.slice(1),
			status:'ask'
		});
	} else {
		// this also covers the case of somebody trying to input a game
		throw 'Bad syntax. Use `!!'+cmd+' @yourOpponent`';
	}
}

exports.onNewShoe = function(shoe){
	shoe.socket.on('ludo.accept', function(arg){
		dbGetGame(shoe, arg.mid).spread(function(m, game){
			game.players[0].id = shoe.publicUser.id;
			game.status = 'running';
			m.changed = ~~(Date.now()/1000);
			storeInMess(m, game);
			return this.storeMessage(m, true);
		}).then(function(m){
			shoe.emitToRoom('message', m);
		}).finally(shoe.db.off);
	}).on('ludo.move', function(arg){
		dbGetGame(shoe, arg.mid).spread(function(m, game){
			var gametype = gametypes[game.type],
				move = gametype.decodeMove(arg.move);
			if (gametype.isValid(game, move)) {
				gametype.apply(game, move);
				game.moves += arg.move;
				shoe.emitToRoom('ludo.move', {mid:m.id, move:move});
				storeInMess(m, game);
				m.changed = ~~(Date.now()/1000);
				return this.storeMessage(m, true);
			} else {
				console.log('ludo : illegal move', move);
			}
		}).finally(shoe.db.off);
	});
}

exports.registerCommands = function(cb){
	cb('game', onCommand, "propose a random game. Type `!!game @somebody`");
	for (var key in gametypes) cb(key.toLowerCase(), onCommand, "propose a game of "+key+". Type `!!"+key.toLowerCase()+" @somebody`");
}
