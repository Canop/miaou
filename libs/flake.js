// flakes are unpersisted messages (with no id)

exports.configure = function(miaou){
	return this;
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name:'flake',
		fun:function(ct){
			delete ct.message.id; // to prevent injection 
			ct.nostore = true;
			ct.text(ct.text().replace(/^\s*!!flake\s*/,''));
			if (!ct.text().trim().length) throw "You can't send an empty flake";
		},
		help:"send a flake, a message that won't be saved, only visible by users currently in room"
	});
}
