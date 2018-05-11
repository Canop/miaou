// do the dirty work for !!github and !!bitbucket commands enabling
// the publication of bot messages on repository events sent through
// webhooks to Miaou
// Providers are objects {
// 	key: "github"|"bitbucket"
// 	doc(): returns the simple !!help documentation
// 	detailedDoc(): returns the detailed !!help documentation
// }

const	providers = [require("./github.js").provider],
	path = require('path');

var	config,
	ws,
	bots,
	db;

exports.name = "SCM-Hooks";

// called with context the db, return a promise
function initProvider(p){
	return this.getBot(p.botName)
	.then(function(bot){
		p.bot = bot;
		if (p.botAvatar.src===bot.avatarsrc && p.botAvatar.key===bot.avatarkey) return;
		bot.avatarsrc = p.botAvatar.src;
		bot.avatarkey = p.botAvatar.key;
		return this.updateUser(bot);
	})
	.then(function(){
		return this.getUserInfo(p.bot.id);
	})
	.then(function(info){
		if (info.description===p.botInfo.description) return;
		return this.updateUserInfo(p.bot.id, p.botInfo);
	})
	.then(function(){
		bots.register(p.bot);
		return p;
	});
}

exports.init = function(miaou){
	config = miaou.config;
	db = miaou.db;
	ws = miaou.lib("ws");
	bots = miaou.lib("bots");
	return db.upgrade(exports.name, path.resolve(__dirname, 'sql'))
	.then(function(){
		return db.on(providers)
		.each(initProvider)
		.finally(db.off);
	});
}

// gives the normal callback that must be configured provider-side
function getCallback(provider){
	return config.server + "/" + provider.key + "-webhook";
}
function watchRepo(ct, provider, repo){
	return db.on()
	.then(function(){
		return this.queryRow(
			"select repo, nb_calls from scm_hook where provider=$1 and repo ilike $2",
			[provider.key, repo],
			"scm-hooks / repo"
		); // throw NRE if unknown
	})
	.then(function(gh){
		console.log("SCM Hook found:", gh);
		return this.queryRow(
			"insert into scm_hook_room (provider, repo, room) values($1,$2,$3) returning *",
			[provider.key, gh.repo, ct.shoe.room.id],
			"scm-hooks / insert hook_room"
		);
	})
	.then(function(ghr){
		ct.reply("The room is now hooked to "+ghr.repo);
	})
	.catch(db.NoRowError, function(){
		ct.reply(
			"No webhook seems to be defined for repository `"+repo+"`.\n"
			+" Check you correctly spelled the repository, then check the webhook configuration"
			+" in the repository settings.\n"
			+" The callback should be `"+getCallback(provider)+"`"
		);
	}).finally(db.off);
}
function unwatchRepo(ct, provider, repo){
	return db.on()
	.then(function(){
		return this.execute(
			"delete from scm_hook_room where provider=$1 and repo=$2 and room=$3",
			[provider.key, repo, ct.shoe.room.id],
			"scm-hooks / delete hook_room"
		);
	})
	.then(function(){
		ct.reply("The room is unhooked from "+repo);
	}).finally(db.off);
}

function listRepos(ct, provider){
	return db.on()
	.then(function(){
		return this.queryRows(
			"select repo from scm_hook_room where provider=$1 and room=$2",
			[provider.key, ct.shoe.room.id],
			"scm-hooks / delete room_repos"
		);
	})
	.then(function(rows){
		if (rows.length) {
			ct.reply(
				"Watched repositories:\n"+rows.map(function(row){
					return "* ["+row.repo+"]("+provider.repoURL(row.repo)+")";
				}).join('\n')
			);
		} else {
			ct.reply("No repository is watched in this room");
		}
	}).finally(db.off);
}

async function onCommand(ct, provider){
	var m;
	if ((m=ct.args.match(/^watch (?:https?:\/\/github\.com\/)?([\w-]+\/[\w-.]+)/))) {
		ct.shoe.checkAuth("admin");
		await watchRepo.call(this, ct, provider, m[1]);
	} else if ((m=ct.args.match(/^unwatch (?:https?:\/\/github\.com\/)?([\w-]+\/[\w-.]+)/))) {
		ct.shoe.checkAuth("admin");
		await unwatchRepo.call(this, ct, provider, m[1]);
	} else if (ct.args==="list") {
		await listRepos.call(this, ct, provider);
	} else {
		ct.reply("Command not understood. Try `!!help !!"+provider.command+"` for more information.", true);
	}
	ct.end();
}

function scmCalling(provider, req, res){
	console.log("SCM "+provider.key+" CALLED");
	console.log("headers:", req.headers);
	console.log("body:", req.body);
	var	queryRooms = req.query.rooms || req.query.room || "",
		rooms = queryRooms.split(/\D+/).filter(Boolean).map(Number),
		anal;
	try {
		anal = provider.analyzeIncomingData(req.headers, req.body);
	} catch (e) {
		console.log("ERROR WHILE ANALYZING HOOK MESSAGE:", e);
		return res.status(400).send('Hu?');
	}
	res.send('Okey');
	db.on()
	.then(function(){
		return this.execute(
			"update scm_hook set nb_calls=nb_calls+1 where provider=$1 and repo=$2",
			[provider.key, anal.repo],
			"scm-hooks / update hook"
		);
	})
	.then(function(res){
		if (!res.rowCount) {
			console.log("NEW HOOK");
			return this.execute(
				"insert into scm_hook (provider, repo, nb_calls) values($1,$2,1)",
				[provider.key, anal.repo],
				"scm-hooks / insert hook"
			);
		}
	})
	.then(function(){
		return this.queryRows(
			"select room from scm_hook_room where provider=$1 and repo=$2",
			[provider.key, anal.repo],
			"scm-hooks / romm_hook"
		);
	})
	.then(function(rows){
		if (!anal.content) {
			console.log("empty message not sent");
			return;
		}
		rows.forEach(function(row){
			if (rooms.length && rooms.indexOf(row.room)===-1) {
				console.log("Not in white list:", row.room);
				return;
			}
			ws.botMessage(provider.bot, row.room, anal.content);
		});
	})
	.finally(db.off);
}

exports.registerRoutes = function(map){
	providers.forEach(function(p){
		var route = "/"+p.key+"-webhook";
		require('../../libs/anti-csrf.js').whitelist(route);
		map('post', route, (req, res) => scmCalling(p, req, res), true, true);
	});
}

exports.registerCommands = function(cb){
	providers.forEach(function(p){
		cb({
			name: p.command,
			fun: ct => onCommand.call(this, ct, p),
			help: p.help,
			detailedHelp: function(room){
				return p.detailedHelp(config);
			}
		});
	});
}
