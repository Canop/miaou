// flakes are unpersisted messages (with no id)

exports.configure = function(miaou){
	return this;
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name:'flake',
		fun:function(ct){
			if (ct.message.id) throw "You can't change a persistent message to a flake";
			ct.nostore = true;
			ct.text(ct.text().replace(/!!flake\s*/, ''));
			if (!ct.text().trim().length) throw "You can't send an empty flake";
			ct.end();
		},
		help:"send a flake, a message that won't be saved, only visible by users currently in room"
	});
}
