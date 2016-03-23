const	name = 'stackexchange',
	util = require('util'),
	OAuth2Strategy = require('passport-oauth').OAuth2Strategy,
	zlib = require('zlib'),
	apiBaseUrl = "https://api.stackexchange.com/2.1/me?site=stackoverflow",
	request = require("request");

function Strategy(options, verify){
	options = options || {};
	options.authorizationURL = options.authorizationURL || 'https://stackexchange.com/oauth';
	options.tokenURL = options.tokenURL || 'https://stackexchange.com/oauth/access_token';
	options.scopeSeparator = options.scopeSeparator || ',';
	if (options.key === undefined) throw new Error("No Stackexchange API Key");
	this._options = options;
	OAuth2Strategy.call(this, options, verify);
	this.name = name;
}

util.inherits(Strategy, OAuth2Strategy);

Strategy.prototype.userProfile = function(accessToken, done){
	var	gz = zlib.createGunzip(),
		body = '';

	request({
		url: apiBaseUrl + "&key=" + this._options.key + "&access_token=" + accessToken,
		headers: { 'Accept-Encoding': 'gzip' }
	}).pipe(gz);

	gz.on('data', function(data){
		body += data;
	});
	gz.on('end', function(){
		try {
			var data = JSON.parse(body.trim()),
				item = data.items[0];
			item.provider = name;
			done(null, item);
		} catch (err) {
			console.log(body);
			done(err);
		}
	});
	gz.on('error', function(err){
		done(err);
	});
}

exports.Strategy = Strategy;
