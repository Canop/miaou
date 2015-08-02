
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

function watchRepo(ct, repo){
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
function unwatchRepo(ct, repo){
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
function listRepos(ct){
	return db.on()
	.then(function(){
		return this.queryRows("select repo from github_hook_room where room=$1", [ct.shoe.room.id]);
	})
	.then(function(rows){
		if (rows.length) {
			ct.reply(
				"Watched repositories:\n"+rows.map(function(row){
					return "* ["+row.repo+"](https://github.com/"+row.repo+")";
				}).join('\n')
			);
		} else {
			ct.reply("No repository is watched in this room");
		}
	}).finally(db.off);
}

function onCommand(ct){
	var m;
	if (m=ct.args.match(/^watch ([\w-]+\/[\w-.]+)/)) {
		ct.shoe.checkAuth("admin");
		return watchRepo.call(this, ct, m[1]);
	}
	if (m=ct.args.match(/^unwatch ([\w-]+\/[\w-.]+)/)) {
		ct.shoe.checkAuth("admin");
		return unwatchRepo.call(this, ct, m[1]);
	}
	if (ct.args==="list") {
		return listRepos.call(this, ct);
	}
	ct.reply("Command not understood. Try `!!help !!github` for more information.", true);
}

function link(o, label, url){
	return "["
	+ (label||o.full_name||o.name||o.title||o.page_name||o.login||o.tag_name||o.timestamp||o.id)
	+ "]("
	+ (url||o.html_url||o.url||("https://github.com/"+(o.username||o.login||o.name)))
	+ ")";
}

function pushComment(arr, comment){
	arr.push(link(comment, "Comment")+":");
	arr.push.apply(arr, comment.body.replace(/\s*$/,'').split(/\r?\n/).map(function(line){
		return "> "+line;
	}));
}

// Builds the markdown from the received data
// Not (yet) done:
//  - https://developer.github.com/v3/activity/events/types/#deploymentevent
//  - https://developer.github.com/v3/activity/events/types/#deploymentstatusevent
//  - https://developer.github.com/v3/activity/events/types/#memberevent
//  - https://developer.github.com/v3/activity/events/types/#publicevent
//  - https://developer.github.com/v3/activity/events/types/#statusevent
function eventToMarkdown(event, data){
	var	repo = data.repository,
		big = [],
		small = [];
	if (event==='watch' && data.sender) {
		small.push('★ ' + link(data.sender) + " starred " + link(repo));
	}
	if (data.pusher) { // event: push
		big.push(link(data.pusher) + " pushed in " + link(repo));
	}
	if (event==='commit_comment') {
		big.push(link(data.comment.user) + " commented a commit in " + link(repo));
		pushComment(small, data.comment);
	}
	if (event==='issue_comment') {
		big.push(link(data.sender) + " commented an issue in " + link(repo));
		small.push("Issue #" + data.issue.number + ": " + link(data.issue));
		pushComment(small, data.comment);
	}
	if (event==='issues') {
		big.push("Issue " + data.action + " in " + link(repo));
		small.push("Issue #" + data.issue.number + ": " + link(data.issue));
	}
	if (event==='pull_request') {
		big.push("Pull Request " + data.action + " by " + link(data.sender) + " in " + link(repo));
		small.push("Pull Request: " + link(data.pull_request));
	}
	if (event==='pull_request_review_comment') {
		big.push(link(data.sender) + " commented a pull request in " + link(repo));
		small.push("Pull Request: " + link(data.pull_request));
		pushComment(small, data.comment);
	}
	if (event==='release') {
		big.push("Release " + link(data.release) + " " + data.action + " in " + link(repo));
	}
	if (data.ref_type && data.sender) { 
		var verb = event==='create' ? " added a " : " deleted a ";
		var s = link(data.sender) + verb + data.ref_type;
		if (data.ref) s += " ("+data.ref+")";
		s += " in " + link(repo);
		big.push(s);
	}
	if (data.forkee) {
		big.push(link(repo) + " forked into " + link(data.forkee));
	}
	if (data.pages) {
		big.push("Wiki of " + link(repo) + " updated");
		data.pages.forEach(function(page){
			small.push(link(page)+" "+page.action);
		});
	}
	if (data.compare) {
		small.push('[Comparison]('+data.compare+')');
	}
	if (data.commits && data.commits.length) {
		small.push("|Commit|Committer|Message|\n"
		+ "|:-:|:-:|:-|\n"
		+ data.commits.map(function(c){
			return '|'+link(c, Date(c))+'|'
			+ link(c.committer)+'|' 
			+ c.message.split('\n',1)[0]+'|\n';
	       }).join(''));
	}
	return big.map(function(t){ return "**"+t+"**\n" })
	+ small.join('\n');
}

// called by the GitHub API
function githubCalling(req, res){
	console.log("GITHUB CALLING");
	// console.log("headers:", req.headers);
	// console.log("body:", req.body);
	var	data = req.body,
		queryRooms = req.query.rooms || req.query.room || "",
		rooms = queryRooms.split(/\D+/).filter(Boolean).map(Number);
	console.log("ROOMS:", rooms);
	if (!data.repository) {
		console.log('bad github request');
		return res.status(400).send('Hu?');
	}
	var	repo = data.repository.full_name;
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
		var content = eventToMarkdown(req.headers['x-github-event'], data);
		if (!content) {
			console.log("empty message not sent");
			return;
		}
		rows.forEach(function(row){
			if (rooms.length && rooms.indexOf(row.room)===-1) {
				console.log("Not in white list:", row.room);
				return;
			}
			ws.botMessage(me, row.room, content);
		});
	}).finally(db.off);
}
exports.registerRoutes = function(map){
	require('../../libs/anti-csrf.js').whitelist(webhookroute);
	map('post', webhookroute, githubCalling, true, true);
}

exports.registerCommands = function(cb){
	cb({
		name:'github', fun:onCommand,
		help:"interact with GitHub. Type `!!help !!github` to learn more.",
		detailedHelp:
		 "In order to receive in a Miaou room all events related to a GitHub repository, you must\n"
		+"1. set up a webhook in GitHub\n"
		+"2. call the `!!github watch` command in the room\n"
		+"To achieve that you must have admin rights both on the GitHub repository and in the room.\n"
		+"\n"
		+"To set up the webhook, go to the *Settings* of your repository on GitHub, select *Webhooks & Services*,\n"
		+"then click *Add webhook*.\n"
		+"You'll have to provide a callback to the webhook.\n"
		+"In case there's nothing secret in your repository, simply give\n"
		+"    "+config.server+webhookroute+"\n"
		+"If you want to ensure only one room (say the room 5) or several rooms (say 5 and 15) have acces\n"
		+"to those GitHub events, specify the rooms in the callback as in\n"
		+"    "+config.server+webhookroute+"?room=5\n"
		+"or\n"
		+"    "+config.server+webhookroute+"?rooms=5,15\n"
		+"\n"
		+"After you've set up the webhook GitHub side, issue the relevant command in the Miaou room,\n"
		+"for example\n"
		+"     !!github watch Canop/miaou\n"
		+"To see what repositories are watched, use	    \n"
		+"     !!github list\n"
		+"To stop watching a repository, use\n"
		+"     !!github unwatch Canop/miaou\n"
	});
}
