var path = require('path'),
	server = require('./server.js'),
	bot, botname = "miaou.help",
	commands = {};

exports.configure = function(config){
	var plugins = (config.plugins||[]).map(function(n){ return require(path.resolve(__dirname, '..', n)) }),
		helpmess = 'For a detailed help on Miaou, see the [help page]('+server.url('/help')+')\nCommands :';
	plugins.forEach(function(plugin){
		if (plugin.registerCommands) plugin.registerCommands(function(name, fun, help){
			commands[name] = {fun:fun, help:help};
			helpmess += '\n* `' + name + '` : ' + help;
		});
	});
	commands['help'] = {fun:function(cmd, shoe, m){
		setTimeout(function(){
			var message = {content:helpmess, authorname:botname, room:shoe.room.id, created:~~(Date.now()/1000)};
			shoe.db.on().then(function(){
				return bot || this.getBot(botname).then(function(b){ bot = b; return b })
			}).then(function(b){
				message.author = b.id;
				return this.storeMessage(message); 
			}).then(function(m){
				m.bot = true;
				shoe.emitToRoom('message', m);
				console.log('EM', m);
			}).finally(shoe.db.off)
		}, 10);
	}};
}

exports.onMessage = function(shoe, m){
	var cmdMatch = m.content.match(/^!!(\w+)/);
	if (cmdMatch) {
		var cmd = cmdMatch[1] ;
		if (commands[cmd]) commands[cmd].fun(cmd, shoe, m);
		else throw ('Command "' + cmd + '" not found');
	}
}
