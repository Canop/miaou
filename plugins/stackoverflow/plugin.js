
var Promise = require("bluebird"),
	request = require('request');
	
exports.name = "StackOverflow";


// returns a promise
// updates and provides in resolution the pluginPlayerInfos if successful, else throws an error 
function createSOProfile(ppi, vals) {
	var p = Promise.defer();
	request('http://stackoverflow.com/users/'+vals.so_num, function(error, res, body){
		if (!error && res.statusCode===200) {
			console.log(body);
			if (/miaou/i.test(body)) {
				ppi.num = vals.so_num;
				p.resolve(ppi);
			} else {
				p.reject("Required URL wasn't found in profile");
			}
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
		var html = '';
		html += '<img src=http://stackoverflow.com/users/flair/'+ppi.num+'.png>';
		return html
	}
}

exports.externalProfile = {
	creation: {
		description: "",
		fields: [
			{ name:'so_num', label:'StackOverflow User ID', type:'Number' }
		],
		create: createSOProfile
	}, render: renderSOProfile
}
