var path = require('path'),
	Promise = require("bluebird"),
	server = require('./server.js'),
	bot, botname = "miaou.help",
	commands = {};

exports.commandDescriptions = {}

exports.configure = function(config, db){
	var plugins = (config.plugins||[]).map(function(n){ return require(path.resolve(__dirname, '..', n)) }),
		helpmess = 'For a detailed help on Miaou, see the [help page]('+server.url('/help')+')\nCommands :';

	db.on(botname).then(db.getBot).then(function(b){ bot = b }).finally(db.off);
	
	function registerCommand(name, fun, help){
		commands[name] = {fun:fun, help:help};
		exports.commandDescriptions[name] = help;
		helpmess += '\n* `' + name + '` : ' + help;	
	}
	plugins.forEach(function(plugin){
		if (plugin.registerCommands) plugin.registerCommands(registerCommand);
	});

	registerCommand('help', function(cmd, shoe, m){
		setTimeout(function(){
			shoe.botMessage(bot, helpmess);
		}, 10);
	}, 'gives this help');
	
	registerCommand('flake', function(cmd, shoe, m, opts){
		delete m.id; // to prevent injection 
		opts.nostore = true;
		m.content = m.content.replace(/^\s*!!flake\s*/,'');
		if (!m.content.trim().length) throw "You can't send an empty flake";
	}, "sends a flake, a message that won't be saved, only visible by users currently in room");
}

// may return a promise
// called with context being a db connection
exports.onMessage = function(shoe, m){
	var cmdMatch = m.content.match(/^!!(\w+)/);
	if (!cmdMatch) return {};	
	var opts = {}, cmd = cmdMatch[1] ;
	if (!commands[cmd] || !commands[cmd].fun) throw 'Command "' + cmd + '" not found';
	return Promise.resolve(commands[cmd].fun.call(this, cmd, shoe, m, opts)).then(function(){
		return opts;
	});
}
