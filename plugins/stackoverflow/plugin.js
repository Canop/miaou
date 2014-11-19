
var Promise = require("bluebird"),
	soboxer = require("./soboxer.js"),
	config,
	request = require('request');
	
exports.name = "StackOverflow";

// returns a promise
// updates and provides in resolution the pluginPlayerInfos if successful, else throws an error 
function createSOProfile(user, ppi, vals) {
	var p = Promise.defer(), num = +vals.so_num;
	request('http://stackoverflow.com/users/'+num, function(error, res, body){
		if (!error && res.statusCode===200) {
			var found, sm, m, r=/<a[^<>]*href="([^"]+)"[^<>]*>([^<>]+)<\/a>/ig;
			while (m=r.exec(body)) {
				if (m[1].indexOf(config.server)==0 && /\bmiaou\b/i.test(m[2])) {
					if (~m[2].split(/\w/).indexOf(user.name)) {
						found = m[0];
						console.log('found with username', found);
					} else if (m[1]===config.server+"/user/"+user.id) {
						found = m[0];
						console.log('found with user id', found);
					} else {
						console.log('url towards miaou but no proof', m[0]);
					}
					if (found) {
						ppi.num = vals.so_num;
						p.resolve(ppi);
					}
				}
			}
			p.reject("Required link wasn't found in Stack Overflow profile.");
		} else {
			p.reject(new Error('Error in querying stackoverflow.com'));
		}
	});
	return p.promise;
}

// returns the HTML of the profile
// or undefined if there's no profile
function renderSOProfile(ppi) {
	if (ppi.num) {
		var html = '<a target=_blank href=http://stackoverflow.com/users/'+ppi.num+'>';
		html += '<img src=http://stackoverflow.com/users/flair/'+ppi.num+'.png>';
		html += '</a>';
		return html
	}
}

function describeSOProfileCreation(user){
	return [
		"to validate you're the owner of this SO account, please put the following link in your SO profile :",
		"<code>["+user.name+" @ Miaou]("+config.server+"/user/"+user.id+")</code>",
		"As StackOverflow doesn't immediately update the public profile, you might have to wait 2 minutes before hitting the <i>Save</i> button below.",
		"You'll be able to remove the link once the profile is checked. It would be nice to keep it, though.",
	].join('<br>');
}

exports.externalProfile = {
	creation: {
		describe: describeSOProfileCreation,
		fields: [
			{ name:'so_num', label:'StackOverflow User ID', type:'Number' }
		],
		create: createSOProfile
	}, render: renderSOProfile
}

// intercepts links to wikipedia and sends boxed abstracts.
// It directly fetches the page because I don't find anything usable
//  for representation using the Wikipedia API.
// Requests are queued and only one at a time is done.
exports.onSendMessage = function(shoe, m, send){
	// TODO How to avoid using two regexes here ?
	if (!m.content || !m.id) return;
	var r = r = /(?:^|\n)\s*https?:\/\/stackoverflow.com\/questions\/(\d+)[^\s#]+(#comment\d+_\d+)?\S*\s*(?:$|\n)/gm,
		match;
	while (match=r.exec(m.content)) {
		var task = { mid:m.id, line:match[0], send:send };
		if (match[2]) {
			task.type = "comments";
			task.num = +match[2].match(/^.{8}(\d+)/)[1];
		} else {
			task.type = "questions";
			task.num = +match[1];
		}
		console.log(task);
		soboxer.addTask(task);
	}
}


exports.init = function(miaou){
	config = miaou.config;
	soboxer.init(miaou);
}
