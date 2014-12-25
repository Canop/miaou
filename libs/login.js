var server = require('./server.js'),
	oauth2Strategies;
	
exports.setOauth2Strategies = function(strategies){
	oauth2Strategies = strategies;
}

exports.appGetLogin = function(req, res){
	res.render('login.jade', {vars:{ oauth2Strategies:oauth2Strategies }});
}

exports.appGetLogout = function(req, res){
	if (req.user) console.log('User ' + req.user.id + ' log out');
	req.logout();
	req.session.secret = null;
	res.redirect(server.url());
}
