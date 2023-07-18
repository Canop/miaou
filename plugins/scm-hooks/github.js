
const fmt = require("../../libs/fmt.js");

// return {
// 	messageId: optional id of a message to edit (instead of creating a new one)
// 	repo: name of the repo (exemple: "Canop/miaou")
// 	content: content (markdown) of the message to send to the room, null if no message must be sent
// 	cb: an optional callback which will be called with the sent message
// }
// throw an exception in case of bad data
function analyzeIncomingData(headers, data){
	if (!data.repository) {
		throw new Error('bad github request');
	}
	let message = eventToMessage(headers['x-github-event'], data);
	if (message) {
		message.repo = data.repository.full_name;
	}
	return message;
}

const REUSE_DURATION = 5*60*1000; // in ms

// A map {repo, {created, starrers, messageId}}, which makes it possible to reuse messages
const starrings = new Map;

function detailedHelp(config){
	return "In order to receive in a Miaou room all events related to a GitHub repository, you must\n"
	+"1. set up a webhook in GitHub\n"
	+"2. call the `!!github watch` command in the room\n"
	+"To achieve that, you must have admin rights both on the GitHub repository and in the room.\n"
	+"\n"
	+"To set up the webhook, go to the *Settings* of your repository on GitHub, select *Webhooks & Services*,\n"
	+"then click *Add webhook*.\n"
	+"Content-type must be `application/json`.\n"
	+"You must provide a callback to the webhook.\n"
	+"In case there's nothing secret in your repository, simply give\n"
	+"    "+config.server+"/github-webhook"+"\n"
	+"If you want to ensure only one room (say the room 5) or several rooms (say 5 and 15) have access\n"
	+"to those GitHub events, specify the room(s) in the callback as in\n"
	+"    "+config.server+"/github-webhook"+"?room=5\n"
	+"or\n"
	+"    "+config.server+"/github-webhook"+"?rooms=5,15\n"
	+"\n"
	+"After you've set up the webhook GitHub side, issue the relevant command in the Miaou room,\n"
	+"for example\n"
	+"     !!github watch Canop/miaou\n"
	+"To see what repositories are watched, use	    \n"
	+"     !!github list\n"
	+"To stop watching a repository, use\n"
	+"     !!github unwatch Canop/miaou\n";
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
	arr.push(...comment.body.replace(/\s*$/, '').split(/\r?\n/).map(function(line){
		return "> "+line;
	}));
}

// Build {messageId, content}
// Not (yet) done:
//  - https://developer.github.com/v3/activity/events/types/#deploymentevent
//  - https://developer.github.com/v3/activity/events/types/#deploymentstatusevent
//  - https://developer.github.com/v3/activity/events/types/#memberevent
//  - https://developer.github.com/v3/activity/events/types/#publicevent
//  - https://developer.github.com/v3/activity/events/types/#statusevent
function eventToMessage(event, data){
	var	repo = data.repository,
		big = [],
		small = [];
	if (event==='watch' && data.sender) {
		let sender = data.sender;
		sender = sender.name || sender.login;
		return starEventToMessage(sender, repo);
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
				return '|'+link(c, c.timestamp.replace("T", " ").replace(/:\d+\+/, " GMT+"))+'|'+
					link(c.committer)+'|'+
					c.message.split('\n', 1)[0]+'|\n';
			}).join(''));
	}
	return {
		content: big.map(t => "**"+t+"**\n") + small.join('\n')
	};
}

// Build {messageId, content} for the case the event is a star ('watch')
function starEventToMessage(starrer, repo){
	let now = (new Date).getTime();
	let starrers;
	let messageId;
	let cb;
	let key = repo.full_name;
	let starring = starrings.get(key);
	if (starring && starring.created+REUSE_DURATION>now) {
		if (starring.starrers.includes(starrer)) {
			console.log("duplicated star");
			return;
		}
		starring.starrers.push(starrer);
		starrers = starring.starrers;
		messageId = starring.messageId;
	} else {
		starrers = [starrer];
		starring = {
			created: now,
			repo,
			starrers,
		};
		cb = function(message){
			starring.messageId = message.id;
			starrings.set(key, starring);
		};
	}
	let content = '★ ' + fmt.oxford(starrers.map(name => link({name}))) + " starred " + link(repo);
	let o = {
		messageId,
		content,
		cb,
	};
	return o;
}

exports.provider = {
	key: "github",
	command: "github",
	botName: "GitHub-Bot",
	botAvatar: {src:'url', key:'https://i.imgur.com/JeB730V.png'},
	botInfo: {
		location:'The Big Cloud In The Sky',
		lang:'en',
		description:"I watch GitHub repositories. Use !!github"
	},
	repoURL: repo => "https://github.com/"+repo,
	analyzeIncomingData,
	help: "interact with GitHub. Type `!!help !!github` to learn more.",
	detailedHelp
}

