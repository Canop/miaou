exports.configure = function(miaou){
	return this;
}

function doCommand(ct){
	return this.listActiveBans(ct.shoe.room.id).then(function(bans){
		var c;
		if (!bans.length) {
			c = "nothing found";
		} else {
			c = "Room bans:\n";
			c += "Name | Banned by | Expiration | Reason\n";
			c += "-|-|-|-\n";
			c += bans.map(function(b){
				return [
					"["+b.bannedname+"](u/"+b.bannedname+")",
					b.bannername,
					new Date(b.expires*1000),
					b.reason || '*no reason*'
				].join('|')
			}).join('\n');
		}
		ct.noStore = true;
		ct.reply(c, true).end();
	});
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name: 'bans', fun:doCommand,
		help: "list the bans of the room",
		canBePrivate: true,
		detailedHelp: "list all banned users in this room.\n"+
			"Only list active bans."
	});
}
