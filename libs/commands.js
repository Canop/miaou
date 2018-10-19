const	path = require('path'),
	bench = require("./bench.js"),
	server = require('./server.js'),
	commands = {};

let	all = [];

const	commandParsingRegex = require("./rex.js")`
	^ {0,3}                         // up to 3 spaces allowed at start
	(?:@\w[\w\-]{2,19}#?\d*\s+)?    // a reply or ping is allowed
	!!
	(!)?                            // the third ! means it's a private command
	(\w+)                           // the command
	\s*
	([^\n]*)                        // command arguments
	`;

class CommandTask{
	constructor(cmd, rp, args, shoe, message){
		this.cmd = cmd;
		this.private = !!rp; // did the user ask for a private command (with three !)
		this.message = message;
		this.args = args ? args.trim() : '';
		this.shoe = shoe;
		this.nostore = false; // commands can set it true to prevent source message to be stored
		this.silent = false; // commands can set it true to prevent source message to be distributed (and stored)
		this.replyer = null; // will be the miaou bot if undefined
		this.replyContent = null;
		this.replyAsFlake = false;
		this.alwaysPing = false; // do cross room pings even if the user has no authorization
		this.withSavedMessage = null; // commands can set a callback which will be called with (shoe, message)
		this.ignoreMaxAgeForEdition = false;
		this.bo = bench.start(`!!${cmd.name}`);
	}
	async exec(con){
		if (this.private && !this.cmd.canBePrivate) {
			throw new Error("This command can't be executed privately. Use !!, not !!!");
		}
		await this.cmd.fun.call(con, this);
		if (this.silent || this.private) this.nostore = true;
		return this;
	}
	reply(content, asFlake){
		this.replyContent = content;
		this.replyAsFlake = !!asFlake;
		return this;
	}
	// called at the very end of the action (can be asynchronous), enables benchmarking
	// return the duration (which might be used for logging)
	end(subcommand){
		if (subcommand) this.bo.rename(`!!${this.cmd.name} / ${subcommand}`);
		return this.bo.end();
	}
	user(){
		return this.shoe.publicUser;
	}
	username(){
		return this.shoe.publicUser.name;
	}
	text(s){
		if (s!==undefined) this.message.content = s;
		return this.message.content;
	}
	// returns all the text after the command (and the ping or reply
	//  if there's one before the command). The difference with ct.args
	//  is that ct.args stops at end of first line
	textAfterCommand(s){
		let index = this.message.content.indexOf("\n");
		return index>0 ? this.args+this.message.content.slice(index) : this.args;
	}
}

exports.configure = function(miaou){
	let	config = miaou.config,
		plugins = (config.plugins||[]).map( n => require(path.resolve(__dirname, '..', n)) );
	function registerCommand(cmd){
		commands[cmd.name] = cmd;
		all.push(cmd);
	}
	plugins.forEach(function(plugin){
		if (plugin.registerCommands) plugin.registerCommands(registerCommand);
	});
	registerCommand({
		name: 'help',
		fun: function(ct){
			let match = ct.message.content.match(/!!help\s+(!!)?(\w+)/);
			ct.nostore = true;
			ct.reply(getHelpText(ct.shoe.room, match ? match[2] : null), true);
			ct.end();
		},
		canBePrivate: true,
		help: 'get help about commands. Usage : `!!help !!commandname`',
		detailedHelp: "You can also get a list of all commands with just `!!help`"
	});
	['afk', 'ban', 'bans', 'bench', 'flake', 'list-users', 'pm', 'prefs', 'summon', 'tag-command', 'web-push']
	.forEach(function(module){
		miaou.lib(module).registerCommands(registerCommand);
	});
	all.sort((a, b) => a.name>b.name ? 1 : -1);
}

let getHelpText = exports.getHelpText = function(room, cmdname){
	if (cmdname) {
		let cmd = commands[cmdname];
		if (!cmd) return "Command `"+cmdname+"` not found";
		if (cmd.filter!==undefined && !cmd.filter(room)) return "Command `"+cmdname+"` not available in this room";
		let h = '`!!' + cmd.name + '` : ' + (cmd.help||"*secret command*");
		if (cmd.detailedHelp) {
			if (typeof cmd.detailedHelp==="function") {
				h += '\n'+cmd.detailedHelp(room);
			} else {
				h += '\n'+cmd.detailedHelp;
			}
		}
		return h;
	} else {
		return 'For a detailed help on Miaou, see the [help page]('+server.url('/help')+').\nCommands :'+
		all.filter(cmd => cmd.help && (cmd.filter===undefined || cmd.filter(room)))
		.map(cmd => '\n* `!!' + cmd.name + '` : ' + cmd.help)
		.join('');
	}
}

exports.availableCommandNames = function(room){
	return all.filter(cmd => cmd.help && (cmd.filter===undefined || cmd.filter(room))).map(c=>c.name);
}

exports.commands = commands;

// may return a promise
// called with context being a db connection
exports.onMessage = function(shoe, m){
	let cmdMatch = m.content.match(commandParsingRegex);
	if (!cmdMatch) return {};
	let cmd = commands[cmdMatch[2]];
	if (!cmd || !cmd.fun) throw 'Command "' + cmdMatch[2] + '" not found';
	let rp = !!cmdMatch[1];
	if (rp && m.id) throw "You can't edit a public message into a private command";
	if (cmd.filter && !cmd.filter(shoe.room)) throw 'Command "'+cmd.name+'" not available in this room';
	return (new CommandTask(cmd, rp, cmdMatch[3], shoe, m)).exec(this);
}

// may return a promise
// called with context being a db connection
exports.onBotMessage = function(bot, m){
	let cmdMatch = m.content.match(commandParsingRegex);
	if (!cmdMatch) return {};
	let cmd = commands[cmdMatch[2]];
	if (!cmd || !cmd.botfun) return;
	return cmd.botfun.call(this, cmd, cmdMatch[3], bot, m);
}

