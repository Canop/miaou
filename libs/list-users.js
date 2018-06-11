// !!lu : list all room users (having rights or having posted)
// !!la : list all room admins

exports.configure = function(miaou){
	return this;
}

function la(ct){
	return this.listRoomAuths(ct.shoe.room.id)
	.filter(a => a.auth==="admin" || a.auth==="own")
	.then(function(auths){
		ct.nostore = true;
		var lines = [
			"Room admins:", "user|level", ":-:|:-:",
			...auths.map(a => a.name + "|" + a.auth).sort()
		];
		ct.reply(lines.join("\n"), true);
		ct.end();
	});
}

function lu(ct){
	return this.listRoomUsers(ct.shoe.room.id).then(function(names){
		ct.nostore = true;
		ct.reply(
			"Room users:"+names.map(u => "\n* "+u.name).sort().join(''),
			true
		);
		ct.end();
	});
}


exports.registerCommands = function(registerCommand){
	registerCommand({
		name: 'la',
		fun: la,
		help: "list admins of the room",
		canBePrivate: true,
		detailedHelp: "list users having admin rights in this room."
	});
	registerCommand({
		name: 'lu',
		fun: lu,
		help: "list the users of the room",
		canBePrivate: true,
		detailedHelp: "list users having posted in the room or watching it.\n"+
			"Those are the users receiving a `@room` message."
	});
}

