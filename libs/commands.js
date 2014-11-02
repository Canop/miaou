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
	function registerCommand(cmd){
		commands[cmd.name] = cmd;
		all.push(cmd);
	}
	plugins.forEach(function(plugin){
		if (plugin.registerCommands) plugin.registerCommands(registerCommand);
	});
	registerCommand({
		name:'help',
		fun:function(cmd, shoe, message){
			setTimeout(function(){
				var match = message.content.match(/^!!help\s+(!!)?(\w+)/); 
				shoe.botMessage(bot, getHelpText(shoe.room, match ? match[2] : null));
			}, 10);
		},
		help:'get help about commands. Usage : `!!help !!commandname`',
		detailedHelp:"You can also get a list of all commands with just `!!help`"
	});
	['afk','ban','flake','stats','summon'].forEach(function(cmd){
		require('./'+cmd+'.js').configure(miaou).registerCommands(registerCommand);
	});
	all.sort(function(a,b){ return a.name>b.name ? 1 : -1 });
}

var getHelpText = exports.getHelpText = function(room, cmdname){
	if (cmdname) {
		var cmd = commands[cmdname];
		if (!cmd) return "Command `"+cmdname+"` not found";
		if (cmd.filter!==undefined && !cmd.filter(room)) return "Command `"+cmdname+"` not available in this room";
		var h = '`!!' + cmd.name + '` : ' + cmd.help;
		if (cmd.detailedHelp) h += '\n'+cmd.detailedHelp;
		return h;
	} else {
		return 'For a detailed help on Miaou, see the [help page]('+server.url('/help')+').\nCommands :'+
		all.filter(function(cmd){
			return cmd.filter===undefined || cmd.filter(room)
		}).map(function(cmd){
			return '\n* `!!' + cmd.name + '` : ' + cmd.help
		}).join('');
	}
}

exports.commands = commands;

// may return a promise
// called with context being a db connection
exports.onMessage = function(shoe, m){
	var cmdMatch = m.content.match(/^!!(\w+)/);
	if (!cmdMatch) return {};	
	var opts = {}, cmd = commands[cmdMatch[1]];
	if (!cmd || !cmd.fun) throw 'Command "' + cmdMatch[1] + '" not found';
	if (cmd.filter && !cmd.filter(shoe.room)) throw 'Command "'+cmd.name+'" not available in this room';
	return Promise.resolve(cmd.fun.call(this, cmd.name, shoe, m, opts)).then(function(){
		return opts;
	});
}
