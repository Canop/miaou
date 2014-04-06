// Games are stored in JSON in messages
// A valid game (even before accept) is always stored like this :
//  !!game @otherPlayer jsonEncodedGame

var gametypes = {
	Tribo: require('./Tribo.js')
}

// returns a bound promise opening a connection to the db
//  and returning both the message and the game whose id is passed
// The caller **must** end the promise chain with off
// TODO use a game cache
function dbGetGame(shoe, mid){
	return shoe.db.on(mid).then(function(){
		return this.getMessage(mid)
	}).then(function(m){
		return [m, JSON.parse(m.content.split(' ')[2])];
	});
}

function storeInMess(m, game){
	m.content = "!!game @"+game.players[0].name+" "+JSON.stringify(game);	
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
		var gametype = "Tribo",
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
			game.status = 'accepted';
			m.changed = ~~(Date.now()/1000);
			m.room = shoe.room.id; // db.getMessage doesn't provide the room, we must set it before saving
			console.log(m);
			storeInMess(m, game);
			return this.storeMessage(m, false);
		}).then(function(m){
			shoe.emitToRoom('message', m);
		}).catch(function(e){
			console.log('ludo error', e);
		}).finally(shoe.db.off);
	});
}
