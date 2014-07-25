
var Promise = require("bluebird"),
	config = require('../../config.json'),
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
			p.reject("Required link wasn't found in profile");
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
		"You'll be able to remove the link once the profile is checked. It would be nice to keep it, though.",
		"As StackOverflow doesn't immediately update the public profile, you might have to wait 2 minutes before hitting the <i>save</i> button below.",
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
