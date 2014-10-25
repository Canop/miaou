// handles !!afk and !!back

var bot;

exports.configure = function(miaou){
	bot = miaou.bot;
	return this;
}

function makeCommand(status){
	return function(cmd, shoe, m, opts){
		setTimeout(function(){
			// sends a flake to all rooms in which the user is
			var text = '*'+shoe.publicUser.name+'* is *'+status+'*',
				matches = m.content.match(/^!!\w+\s+(.+)$/);
			if (matches) text += ' ( '+matches[1]+' )';
			shoe.userRooms().forEach(function(roomId){
				shoe.emitBotFlakeToRoom(bot, text, roomId);
			});
		}, 100);
		opts.silent = true;
		opts.nostore = true;
	}
}

exports.registerCommands = function(registerCommand){
	var status = {
		afk: 'away from keyboard',
		back: 'back'
	};
	for (var cmd in status) {
		registerCommand(cmd, makeCommand(status[cmd]), "tell the world you're "+status[cmd]);
	}
}
