// Games are stored in JSON in messages
// A valid game (even before accept) is always stored like this :
//  !!game @otherPlayer jsonEncodedGame
// The state of a game isn't sent at each move : clients update it themselves using the moves

var gametypes = {
	Tribo: require('./client-scripts/Tribo.js')
}

// returns a bound promise opening a connection to the db
//  and returning both the message and the game whose id is passed
// The caller **must** end the promise chain with off
// TODO use a game cache
function dbGetGame(shoe, mid){
	return shoe.db.on(mid).then(function(){
		return this.getMessage(mid)
	}).then(function(m){
		var g = JSON.parse(m.content.split(' ')[2]);
		m.room = shoe.room.id; // db.getMessage doesn't provide the room, we must set it before saving
		gametypes[g.type].restore(g);
		return [m, g];
	});
}

function storeInMess(m, game){
	m.content = "!!game @"+game.players[0].name+" "+JSON.stringify({
		type:game.type, current:game.current, status:game.status, moves:game.moves, players:game.players
	});
	delete m.changed;
}

// A message like this starts a game :
//  !!game @someone
//  @someone#1234 !!game
//  @someone !!game
//  !!game @someone
// In the future a third token to specify the game type will be allowed.
// There will probably be also commands, for example "stats"
exports.onNewMessage = function(shoe, m){
	var match = m.content.match(/^(\s*@\w[\w_\-\d]{2,}#?\d*)?\s*!!game\s*(@\w[\w_\-\d]{2,})?\s*$/);
	if (match){
		var ping = match[1]||match[2];
		if (!ping) {
			m.content = "Bad syntax for the game plugin : Use `!!game @yourOpponent`\nor reply to a message and add `!!game`";
			return;
		}
		var gametype = "Tribo", // there's only one type of game for now
			game = {
				players: [
					{name:ping.trim().split('#')[0].slice(1)}, // id will be resolved later
					{id:m.author, name:m.authorname}
				],
				type: gametype,
				status:'ask'
			};
		storeInMess(m, game);
	}
}

exports.onNewShoe = function(shoe){
	shoe.socket.on('ludo.accept', function(arg){
		dbGetGame(shoe, arg.mid).spread(function(m, game){
			game.players[0].id = shoe.publicUser.id;
			game.status = 'running';
			m.changed = ~~(Date.now()/1000);
			console.log(m);
			storeInMess(m, game);
			return this.storeMessage(m, true);
		}).then(function(m){
			shoe.emitToRoom('message', m);
		//~ }).catch(function(e){
			//~ console.log('ludo error', e);
		}).finally(shoe.db.off);
	}).on('ludo.move', function(arg){
		console.log('received move', arg);
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
				console.log('ludo : illegal move');
			}
		//~ }).catch(function(e){
			//~ console.log('ludo error', e);
		}).finally(shoe.db.off);
	});
}
