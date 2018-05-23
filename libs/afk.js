// handles !!afk and !!back

let	bot;

exports.configure = function(miaou){
	bot = miaou.bot;
	return this;
}

function makeCommand(status){
	return function(ct){
		setTimeout(function(){
			// sends a flake to all rooms in which the user is (including via watching)
			var	text = '*'+ct.username()+'* is *'+status+'*';
			if (ct.args) text += ' ( '+ct.args+' )';
			ct.shoe.userRooms().forEach(function(roomId){
				ct.shoe.emitBotFlakeToRoom(bot, text, roomId);
			});
			ct.end();
		}, 100);
		ct.silent = true;
		ct.nostore = true;
	}
}


exports.registerCommands = function(registerCommand){
	var status = {
		afk: 'away from keyboard',
		back: 'back'
	};
	for (var cmd in status) {
		registerCommand({
			name:cmd, fun:makeCommand(status[cmd]),
			help:"tell the world you're "+status[cmd]
		});
	}
}
