"use strict";

const path = require('path'),
	Promise = require("bluebird"),
	server = require('./server.js'),
	botname = "miaou.help",
	commands = {}

var bot,
	all = [];
	
function CommandTask(cmd, args, shoe, message){
	this.cmd = cmd;
	this.message = message;
	this.args = args ? args.trim() : '';
	this.shoe = shoe;
	this.nostore = false; // commands can set it to true to prevent source message to be stored
	this.silent = false; // commands can set it to true to prevent source message to be distributed
	this.replyContent = null;
	this.replyAsFlake = false;
	this.ignoreMaxAgeForEdition = false;
}
CommandTask.prototype.exec = function(con){
	var ct = this;
	return Promise.resolve(ct.cmd.fun.call(con, ct)).then(function(){
		return ct;
	});
}
CommandTask.prototype.reply = function(content, asFlake){
	this.replyContent = content;
	this.replyAsFlake = asFlake;
}
CommandTask.prototype.username = function(){
	return this.shoe.publicUser.name;
}
CommandTask.prototype.text = function(s){
	if (s!==undefined) this.message.content = s;
	return this.message.content;
}

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
		fun:function(ct){
			var match = ct.message.content.match(/!!help\s+(!!)?(\w+)/);
			ct.nostore = true;
			ct.reply(getHelpText(ct.shoe.room, match ? match[2] : null), true);
		},
		help:'get help about commands. Usage : `!!help !!commandname`',
		detailedHelp:"You can also get a list of all commands with just `!!help`"
	});
	['afk','ban','flake','pm','stats','summon'].forEach(function(cmd){
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
	var cmdMatch = m.content.match(/^\s*(@\w[\w\-]{2,}#?\d*\s+)?!!(\w+)\s*([^\n]*)/);
	if (!cmdMatch) return {};
	var cmd = commands[cmdMatch[2]];
	if (!cmd || !cmd.fun) throw 'Command "' + cmdMatch[2] + '" not found';
	if (cmd.filter && !cmd.filter(shoe.room)) throw 'Command "'+cmd.name+'" not available in this room';
	return (new CommandTask(cmd, cmdMatch[3], shoe, m)).exec(this);	
}
