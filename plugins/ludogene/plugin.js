

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
			m.content = "*Bad syntax*. Use\n\t!!game @yourOpponent\nor reply to a message and add `!!game`";
			return;
		}
		console.log(m);
		//~ var gameType = "Tribo",
			//~ game = {
				//~ players: [
					//~ {m
		//~ m.content = ""
		
	}
}
