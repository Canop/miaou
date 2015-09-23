"use strict";

var bot;

exports.configure = function(miaou){
	bot = miaou.bot;
	return this;
}

function doCommand(ct){
	return this.listActiveBans(ct.shoe.room.id).then(function(bans){
		var c;
		if (!bans.length) {
			c = "nothing found";
		} else {		
			c =	"Room bans:"+bans.map(function(b){ return "\n* **"+b.bannedname+"** was banned by "+b.bannername+" until "+new Date(b.expires*1000)+
					" - Reason : "+(b.reason == '' ? "No reason" : b.reason) }).join('');
		}
		ct.noStore = true;
		ct.reply(c, true);
	});
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name: 'bans', fun:doCommand,
		help: "list the bans of the room",
		detailedHelp: "list all banned users in this room.\n"+
			"Only list active bans."
	});
}
