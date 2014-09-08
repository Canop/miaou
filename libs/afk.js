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
			var now = Date.now()/1000|0,
				matches = m.content.match(/^!!\w+\s+(.*)$/),
				out = {
					author:bot.id, authorname:bot.name, created:now,
					content:'*'+shoe.publicUser.name+'* is *'+status+'*'
				};
			if (matches) out.content += ' ( '+matches[1]+' )';
			shoe.userRooms().forEach(function(roomId){
				shoe.io().sockets.in(roomId).emit('message', out);
			});
		}, 100);
		opts.silent = true;
	}
}

exports.registerCommands = function(registerCommand){
	var status = {
		afk: 'away from keyboard',
		back: 'back'
	};
	for (var cmd in status) {
		registerCommand(cmd, makeCommand(status[cmd]), "tells the world you're "+status[cmd]);
	}
}
