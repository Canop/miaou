const	path = require('path'),
	Promise = require("bluebird"),
	server = require('./server.js'),
	commands = {}

var	all = [];

function CommandTask(cmd, args, shoe, message){
	this.cmd = cmd;
	this.message = message;
	this.args = args ? args.trim() : '';
	this.shoe = shoe;
	this.nostore = false; // commands can set it true to prevent source message to be stored
	this.silent = false; // commands can set it true to prevent source message to be distributed (and stored)
	this.replyContent = null;
	this.replyAsFlake = false;
	this.alwaysPing = false; // do cross room pings even if the user has no authorization
	this.ignoreMaxAgeForEdition = false;
}
CommandTask.prototype.exec = function(con){
	var ct = this;
	return Promise.resolve(ct.cmd.fun.call(con, ct))
	.then(function(){
		ct.nostore |= ct.silent;
		return ct;
	});
}
CommandTask.prototype.reply = function(content, asFlake){
	this.replyContent = content;
	this.replyAsFlake = asFlake;
}
CommandTask.prototype.user= function(){
	return this.shoe.publicUser;
}
CommandTask.prototype.username = function(){
	return this.shoe.publicUser.name;
}
CommandTask.prototype.text = function(s){
	if (s!==undefined) this.message.content = s;
	return this.message.content;
}
// returns all the text after the command (and the ping or reply
//  if there's one before the command). The difference with ct.args
//  is that ct.args stops at end of first line
CommandTask.prototype.textAfterCommand = function(s){
	var index = this.message.content.indexOf("\n");
	return index>0 ? this.args+this.message.content.slice(index) : this.args;
}

exports.configure = function(miaou){
	var	config = miaou.config,
		plugins = (config.plugins||[]).map( n => require(path.resolve(__dirname, '..', n)) );
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
	['afk', 'ban', 'bans', 'bench', 'flake', 'list-users', 'pm', 'stats', 'summon'].forEach(function(module){
		require('./'+module+'.js').configure(miaou).registerCommands(registerCommand);
	});
	all.sort((a, b) => a.name>b.name ? 1 : -1);
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
		all.filter(cmd => cmd.help && (cmd.filter===undefined || cmd.filter(room)))
		.map(cmd => '\n* `!!' + cmd.name + '` : ' + cmd.help)
		.join('');
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
// may return a promise
// called with context being a db connection
exports.onBotMessage = function(bot, m){
	var cmdMatch = m.content.match(/^\s*(@\w[\w\-]{2,}#?\d*\s+)?!!(\w+)\s*([^\n]*)/);
	if (!cmdMatch) return {};
	var cmd = commands[cmdMatch[2]];
	if (!cmd || !cmd.botfun) return;
	return cmd.botfun.call(this, cmd, cmdMatch[3], bot, m);
}

