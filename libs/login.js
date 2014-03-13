var utils = require('./app-utils.js'),
	oauth2Strategies;
	
exports.setOauth2Strategies = function(strategies){
	oauth2Strategies = strategies;
}

exports.appGetLogin = function(req, res){
	res.render('login.jade', { user:req.user, oauth2Strategies:oauth2Strategies });
}

exports.appGetLogout = function(req, res){
	if (req.user) console.log('User ' + req.user.id + ' log out');
	req.logout();
	res.redirect(utils.url());
}
