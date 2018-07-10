
var	Promise = require("bluebird"),
	seboxer = require("./se-boxer.js"),
	config,
	request = require('request');

exports.name = "StackOverflow";

// returns a promise
// updates and provides in resolution the pluginPlayerInfos if successful, else throws an error
function createSOProfile(user, ppi, vals){
	var p = Promise.defer(), num = +vals.so_num;
	request('http://stackoverflow.com/users/'+num, function(error, res, body){
		if (!error && res.statusCode===200) {
			var found, m, r=/<a[^<>]*href="([^"]+)"[^<>]*>([^<>]+)<\/a>/ig;
			while ((m=r.exec(body))) {
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
function renderSOProfile(ppi){
	if (!ppi.num) return;
	return `<a target=_blank href=https://stackoverflow.com/users/${ppi.num}>
	<img src=https://stackoverflow.com/users/flair/${ppi.num}.png>
	</a>`;
}

function describeSOProfileCreation(user){
	return `to validate you're the owner of this SO account, please put the following link in your SO profile :<br>
		<code>[${user.name} @ Miaou](${config.server}/user/${user.id})</code><br>
		As StackOverflow doesn't immediately update the public profile,<br>
		 you might have to wait 2 minutes before hitting the <i>Save</i> button below.<br>
		You'll be able to remove the link once the profile is checked. It would be nice to keep it, though.`;
}

exports.externalProfile = {
	creation: {
		describe: describeSOProfileCreation,
		fields: [
			{ name:'so_num', label:'StackOverflow User ID', type:'Number' }
		],
		create: createSOProfile
	},
	rendering: {
		render: renderSOProfile
	}
}

// intercepts links and sends boxed abstracts.
// Requests are queued and only one at a time is done.
// As it is done each time a message is sent, performances are critical
exports.onSendMessage = function(shoe, m, send){
	if (!m.content || !m.id) return;
	seboxer.rawTasks(m.content).forEach(function(task){
		task.mid = m.id;
		task.send = send;
		seboxer.addTask(task);
	});
}

exports.init = function(miaou){
	config = miaou.config;
	seboxer.init(miaou);
	require('./sochat-boxer.js').init(miaou);
}
