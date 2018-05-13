
const	passport = require('passport'),
	util = require('util');

let	db,
	server,
	redirect,
	config;

function IPLoginStrategy(){
	passport.Strategy.call(this);
	this.name = "ip";
}
util.inherits(IPLoginStrategy, passport.Strategy);
IPLoginStrategy.prototype.authenticate = function(req){
	var ipmap = config.pluginConfig["IP-login"].logins;
	var s = this;
	db.on()
	.then(function(){
		var username = ipmap[req.ip];
		if (!username) {
			console.log("No login registered for IP "+req.ip);
			s.fail({message:"No login registered for IP "+req.ip});
			return;
		}
		return this.getUserByName(username).then(function(user){
			if (user) return s.success(user);
			console.log('User '+username+' Not Found');
			s.fail({message:'User Not Found'});
		});
	}).finally(db.off);
}

exports.init = function(miaou){
	config = miaou.config;
	db = miaou.db;
	redirect = miaou.conf("pluginConfig", "IP-login", "redirect");
	server = miaou.lib("server");
	passport.use(new IPLoginStrategy);
}
exports.registerRoutes = function(map){
	map('get', '/ip-login', passport.authenticate('ip', {
		successRedirect: redirect || server.url()
	}), true, true);
}
