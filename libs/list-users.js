var	bot,
	ws = require('./ws.js');

exports.configure = function(miaou){
	bot = miaou.bot;
	return this;
}

function doCommand(ct){
	return this.listRoomUsers(ct.shoe.room.id).then(function(names){
		ct.nostore = true;
		ct.reply(
			"Room users:"+names.map(u => "\n* "+u.name).join(''),
			true
		);
	});
}


exports.registerCommands = function(registerCommand){
	registerCommand({
		name:'lu', fun:doCommand,
		help:"list the users of the room",
		detailedHelp:"list users having posted in the room or watching it.\n"+
			"Those are the users receiving a `@room` message."
	});
}

