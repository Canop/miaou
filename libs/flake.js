// flakes are unpersisted messages (with no id)

exports.configure = function(miaou){
	return this;
}

exports.registerCommands = function(registerCommand){
	registerCommand('flake', function(cmd, shoe, m, opts){
		delete m.id; // to prevent injection 
		opts.nostore = true;
		m.content = m.content.replace(/^\s*!!flake\s*/,'');
		if (!m.content.trim().length) throw "You can't send an empty flake";
	}, "send a flake, a message that won't be saved, only visible by users currently in room");
}
