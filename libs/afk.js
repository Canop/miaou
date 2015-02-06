"use strict";

// handles !!afk and !!back

var bot,
	ws = require('./ws.js');

exports.configure = function(miaou){
	bot = miaou.bot;
	return this;
}

function makeCommand(status){
	return function(ct){
		ws.userRooms.call(this, ct.shoe.publicUser.id).then(function(rooms){
			var	text = '*'+ct.username()+'* is *'+status+'*';
			if (ct.args) text += ' ( '+ct.args+' )';
			for (var roomId of rooms) {
				ct.shoe.emitBotFlakeToRoom(bot, text, roomId);
			}
		});
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
