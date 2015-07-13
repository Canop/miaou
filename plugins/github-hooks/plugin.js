
const	webhookroute = "/github-webhook";

var	config,
	db,
	avatar = {src:'url', key:'https://i.imgur.com/JeB730V.png'},
	botinfo = {location:'The Big Cloud In The Sky', lang:'en', description:"I watch GitHub repositories. Use !!github"},
	me,
	ws = require('../../libs/ws.js'),
	path = require('path');
	
exports.name = "GitHub-Hooks";

exports.init = function(miaou, pluginpath){
	config = miaou.config;
	db = miaou.db;
	db.upgrade(exports.name, path.resolve(pluginpath, 'sql'));
	db.on('GitHub-Bot').then(db.getBot)
	.then(function(bot){
		me = bot;
		if (avatar.src!==me.avatarsrc || avatar.key!==me.avatarkey) {
			me.avatarsrc = avatar.src;
			me.avatarkey = avatar.key;
			return this.updateUser(me)
		}
	}).then(function(){
		return this.getUserInfo(me.id);
	}).then(function(info){
		if (info.description==botinfo.description) return;
		return this.updateUserInfo(me.id, botinfo);
	}).finally(db.off);
}

function addRepo(ct, repo){
	return db.on()
	.then(function(){
		return this.queryRow(
			"select repo, nb_calls from github_hook where repo ilike $1", [repo]
		); // throw NRE if unknown
	})
	.then(function(gh){
		console.log("GitHub Hook found:", gh);
		return this.queryRow(
			"insert into github_hook_room (repo, room) values($1,$2) returning *",
			[gh.repo, ct.shoe.room.id]
		);
	})
	.then(function(ghr){
		ct.reply("The room is now hooked to "+ghr.repo);
	})
	.catch(db.NoRowError, function(){
		ct.reply(
			"No webhook seems to be defined for repository "+repo+".\n"
			+" Check you correctly spelled the repository, then check the webhook configuration"
			+" in [the repository settings](https://github.com/"+repo+"/settings).\n"
			+" The callback should be `"+config.server+webhookroute+"`"
		);
	}).finally(db.off);
}
function removeRepo(ct, repo){
	return db.on()
	.then(function(){
		return this.execute(
			"delete from github_hook_room where repo=$1 and room=$2",
			[repo, ct.shoe.room.id]
		); 
	})
	.then(function(){
		ct.reply("The room is unhooked from "+repo);
	}).finally(db.off);
}

function checkAdmin(ct){
	if (!(ct.shoe.room.auth==='admin'||ct.shoe.room.auth==='own')) {
		throw "Only an admin can do that";
	}
}
function onCommand(ct){
	var m;
	if (m=ct.args.match(/^add ([\w-]+\/[\w-]+)/)) {
		checkAdmin(ct);
		return addRepo.call(this, ct, m[1]);
	}
	if (m=ct.args.match(/^remove ([\w-]+\/[\w-]+)/)) {
		checkAdmin(ct);
		return removeRepo.call(this, ct, m[1]);
	}
	ct.reply("Command not understood", true);
}

function eventToMarkdown(data){
	var repo = data.repository.full_name;
	var title = "["+repo+"](https://github.com/"+repo+")\n";
	if (data.pusher) title = data.pusher.name + " pushed in "+title;
	var txt = '';
	if (data.compare) {
		txt += '[Comparison]('+data.compare+')\n';
	}
	if (data.commits) {
	       txt += "## Commits:\n-|-|-\n"+data.commits.map(function(c){
			return '['+c.timestamp+']('+c.url+')|'
			+c.committer.name+'|'
			+c.message.split('\n',1)[0]+'\n';
	       }).join('');
	}
	return '# '+ title + txt;
}
// called by the GitHub API
function githubCalling(req, res){
	console.log("GITHUB CALLING");
	console.log("headers:", req.headers);
	console.log("query:", req.query);
	console.log("body:", req.body);
	var	data = req.body;
	if (!data.repository) {
		console.log('bad github request');
		return res.status(400).send('Hu?');
	}
	var	repo = data.repository.full_name;
	console.log("REPO:", repo);
	res.send('Okey');
	db.on().then(function(){
		return this.execute("update github_hook set nb_calls=nb_calls+1 where repo=$1", [repo]); 
	}).then(function(res){
		if (!res.rowCount) {
			console.log("NEW HOOK");
			return this.execute("insert into github_hook (repo, nb_calls) values($1, 1)", [repo]); 
		}
	}).then(function(){
		return this.queryRows("select room from github_hook_room where repo=$1", [repo]); 
	}).then(function(rows){
		var content = eventToMarkdown(data);
		rows.forEach(function(row){
			ws.botMessage(me, row.room, content);
		});
	}).finally(db.off);
}
exports.registerRoutes = function(map){
	require('../../libs/anti-csrf.js').whitelist(webhookroute);
	map('get', webhookroute, githubCalling, true, true);
	map('post', webhookroute, githubCalling, true, true);
}

exports.registerCommands = function(cb){
	cb({
		name:'github', fun:onCommand,
		help:"interact with the GitHub API",
		detailedHelp:"bla bla"
	});
}
