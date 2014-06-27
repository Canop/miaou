var path = require('path'),
	server = require('./server.js'),
	bot, botname = "miaou.help",
	commands = {};

exports.commandDescriptions = {}

exports.configure = function(config, db){
	var plugins = (config.plugins||[]).map(function(n){ return require(path.resolve(__dirname, '..', n)) }),
		helpmess = 'For a detailed help on Miaou, see the [help page]('+server.url('/help')+')\nCommands :';
	plugins.forEach(function(plugin){
		if (plugin.registerCommands) plugin.registerCommands(function(name, fun, help){
			commands[name] = {fun:fun, help:help};
			exports.commandDescriptions[name] = help;
			helpmess += '\n* `' + name + '` : ' + help;
		});
	});
	db.on(botname).then(db.getBot).then(function(b){ bot = b }).finally(db.off);
	commands['help'] = {fun:function(cmd, shoe, m){
		setTimeout(function(){
			shoe.botMessage(bot, helpmess);
		}, 10);
	}};
	exports.commandDescriptions['help'] = 'Help';
}

// may return a promise
// called with context being a db connection
exports.onMessage = function(shoe, m){
	var cmdMatch = m.content.match(/^!!(\w+)/);
	if (cmdMatch) {
		var cmd = cmdMatch[1] ;
		if (commands[cmd]) return commands[cmd].fun.call(this, cmd, shoe, m);
		else throw ('Command "' + cmd + '" not found');
	}
}
