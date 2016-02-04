const	auths = require('../../libs/auths.js'),
	ws = require('../../libs/ws.js');

function broadcast(ct){
	if (!auths.isServerAdmin(ct.shoe.completeUser)) {
		throw "Only a server admin can send a global message";
	}
	var	sm = ct.message; // source message
	var	dm = {		 // destination message
		content:ct.textAfterCommand(),
		author:sm.author,
		authorname:sm.authorname,
		avs:sm.avs, // filled ?
		avk:sm.avk,
		created:Date.now()/1000|0
	}
	setTimeout(function(){
		for (let roomId of ws.roomIds()) {
			dm.room = roomId;
			ws.emitToRoom(roomId, 'message', dm);
		}
	}, 50);
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name:'broadcast',
		fun:broadcast,
		help:"send a flake to all rooms",
		detailedHelp:"Only server admins can do that"
	});
}
