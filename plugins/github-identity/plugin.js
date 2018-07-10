// the github-identity plugin lets user prove what GitHub user
// they are in Miaou
var	Promise = require("bluebird"),
	config,
	request = require('request');

exports.name = "GitHub";

function gistText(user){
	return "I am the Miaou user with id "+user.id+" and name \""+user.name+"\" on "+config.server;
}

function fetch(url, p, cb){
	console.log('querying', url);
	request({ url:url, headers:{'User-Agent': 'Canop/miaou'} }, function(error, res, body){
		if (error || res.statusCode!==200) {
			console.log("Error:", error);
			console.log("statusCode:", res.statusCode);
			console.log("body:", body);
			return p.reject(new Error('Error in querying github.com'));
		}
		cb(body);
	});
}

// returns a promise
// updates and provides in resolution the pluginPlayerInfos if successful, else throws an error
function createProfile(user, ppi, vals){
	var	p = Promise.defer(),
		m = vals.gist_url.match(/([a-z0-9]{10,})\/?$/);
	if (!m) p.reject("gist ID not found in URL");
	var gid = m[1];
	fetch('https://api.github.com/gists/'+gid, p, function(body){
		var g = JSON.parse(body),
			filenames = Object.keys(g.files);
		console.log(g);
		if (filenames.length!==1) return p.reject(new Error('Gist must contain exactly one file'));
		if (!g.owner || !g.owner.html_url || !g.owner.login || !g.owner.id) {
			return p.reject(new Error('Missing owner info'));
		}
		if (g.public !== true)  return p.reject(new Error("Gist isn't public"));
		var file = g.files[filenames[0]];
		fetch(file.raw_url, p, function(body){
			if (body.trim()!==gistText(user)) return p.reject(new Error('Wrong text in gist'));
			ppi.id = g.owner.id;
			ppi.login = g.owner.login;
			ppi.avatar = g.owner.avatar_url;
			ppi.url = g.owner.html_url;
			p.resolve(ppi);
		});
	});
	return p.promise;
}

// returns the HTML of the profile
// or undefined if there's no profile
function renderProfile(ppi){
	if (!ppi.id) {
		return '<i class=error>profil invalide</i>';
	}
	return	`<div style="background:white;padding:2px;min-height:30px;line-height:30px;color:black;">
		<img align=left style="max-width:30px;max-height:30px; margin-right:10px;" src="${ppi.avatar}">
		<a target=_blank style="color:black" href="${ppi.url}">${ppi.login}</a>
		</div>`;
}

function describeProfileCreation(user){
	return [
		"to validate you're the owner of a GitHub account,"
		+ " please <a href=https://gist.github.com/ target=_blank>create a public gist</a> with the following :",
		"<code>"+gistText(user)+"</code>",
	].join('<br>');
}

exports.externalProfile = {
	creation: {
		fields: [
			{ name:'gist_url', label:'Gist URL', type:'url' }
		],
		describe: describeProfileCreation,
		create: createProfile
	},
	rendering: {
		render: renderProfile
	},
	avatarUrl: function(ppi){
		return ppi.avatar;
	}

}


exports.init = function(miaou){
	config = miaou.config;
}
