var path = require('path'),
	Promise = require("bluebird"),
	server = require('./server.js'),
	bot, botname = "miaou.help",
	commands = {},
	all = [];

exports.configure = function(miaou){
	var config = miaou.config, db = miaou.db,
		plugins = (config.plugins||[]).map(function(n){ return require(path.resolve(__dirname, '..', n)) });
	db.on(botname).then(db.getBot).then(function(b){ bot = b }).finally(db.off);
	function registerCommand(name, fun, help, filter){
		var cmd = {name:name, fun:fun, help:help, filter:filter};
		commands[name] = cmd;
		all.push(cmd);
	}
	plugins.forEach(function(plugin){
		if (plugin.registerCommands) plugin.registerCommands(registerCommand);
	});
	registerCommand('help', function(cmd, shoe, m){
		setTimeout(function(){
			shoe.botMessage(bot, getHelpText(shoe.room));
		}, 10);
	}, 'gives this help');	
	require('./afk.js').configure(miaou).registerCommands(registerCommand);
	require('./flakes.js').registerCommands(registerCommand);
	all.sort(function(a,b){ return a.name>b.name ? 1 : -1 });
}

var getHelpText = exports.getHelpText = function(room){
	return 'For a detailed help on Miaou, see the [help page]('+server.url('/help')+')\nCommands :'+
	all.filter(function(cmd){
		return cmd.filter===undefined || cmd.filter(room)
	}).map(function(cmd){
		return '\n* `!!' + cmd.name + '` : ' + cmd.help
	}).join('');
}

exports.commands = commands;

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
