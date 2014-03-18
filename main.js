var config = require('./config.json'),
	fs = require("fs"),
	http = require('http'),
	express = require('express'),
	passport = require('passport'),
	login = require('./libs/login.js'),
	db = require('./libs/db.js'),
	utils = require('./libs/app-utils.js').configure(config),
	ws = require('./libs/ws.js').configure(config),
	cookieParser = express.cookieParser(config.secret),
	RedisStore = require('connect-redis')(express),
	sessionStore = new RedisStore({}),
	oauth2Strategies = {},
	app, server;

passport.serializeUser(function(user, done) {
	done(null, user.id);
});
passport.deserializeUser(function(id, done) {
	db.on(id)
	.then(db.getUserById)
	.then(function(user){ done(null, user) })
	.catch(function(err){ done(err) })
	.finally(db.off);
});

(function configureOauth2Strategies(){
	var impls = {
		google: {
			strategyConstructor: require('passport-google-oauth').OAuth2Strategy,
			scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email']
		}, stackexchange: {
			strategyConstructor: require('passport-stackexchange').Strategy
		}, github: {
			strategyConstructor: require('passport-github').Strategy
		}, reddit: {
			strategyConstructor: require('passport-reddit').Strategy,
			scope: 'identity'
		}
	};
	var oauthConfigs = config.oauth2;
	for (var key in oauthConfigs) {
		var params = oauthConfigs[key], impl = impls[key];
		if (!impl) {
			console.log('no implementation for ' + key + ' strategy');
			continue;
		}
		params.callbackURL = utils.url("/auth/"+key+"/callback");
		passport.use(new (impl.strategyConstructor)(params, function(accessToken, refreshToken, profile, done) {			
			db.on(profile)
			.then(db.getCompleteUserFromOAuthProfile)
			.then(function(user){ done(null, user) })
			.catch(function(err){
				console.log('ERR in passport:',err);
				done(err);
			}).finally(db.off);
		}));
		oauth2Strategies[key] = { url: utils.url('/auth/'+key), scope: impl.scope||{} };
	}
	login.setOauth2Strategies(oauth2Strategies);
})();

// defines the routes to be taken by GET and POST requests
function defineAppRoutes(){
	var auths = require('./libs/auths.js'),
		rooms = require('./libs/rooms.js').configure(config),
		upload = require('./libs/upload.js').configure(config),
		profile = require('./libs/profile.js').configure(config),
		chat = require('./libs/chat.js'),
		help = require('./libs/help.js');
	function ensureAuthenticated(req, res, next) {
		if (req.isAuthenticated()) return next();
		var roomId = req.params[0];
		res.redirect(utils.url(roomId ? '/login?room=' + roomId : '/login'));
	}
	function map(verb, path, fun, noNeedForCompleteProfile, noNeedForLogin){
		var args = [path];
		if (!noNeedForLogin) args.push(ensureAuthenticated);
		if (!noNeedForCompleteProfile) args.push(ensureAuthenticated);
		args.push(fun.length<=2 ? fun : function(req, res){ fun(req, res, db) });
		app[verb].apply(app, args);
	}
	for (var key in oauth2Strategies){
		var s = oauth2Strategies[key];
		app.get('/auth/'+key, passport.authenticate(key, {scope:s.scope, state:'Ohio', duration:'permanent'}));
		app.get('/auth/'+key+'/callback', passport.authenticate(key, { failureRedirect: '/login' }), function(req, res) { res.redirect(utils.url()) });		
	}
	map('get', '/login', login.appGetLogin, true, true);
	map('get', '/logout', login.appGetLogout, true, true);
	map('get', /^\/(\d+)?$/, chat.appGet);
	map('get', '/room', rooms.appGetRoom);
	map('post', '/room', rooms.appPostRoom);
	map('get', '/rooms', rooms.appGetRooms);
	map('get', '/auths', auths.appGetAuths);
	map('post', '/auths', auths.appPostAuths);
	map('all', '/profile', profile.appAllProfile, true);
	map('get', '/publicProfile', profile.appGetPublicProfile, true, true);
	map('get', /^\/user\/(\d+)$/, profile.appGetUser, true, true);
	map('get', '/help', help.appGetHelp, true, true);
	map('post', '/upload', upload.appPostUpload, true);
}

// starts the whole server, both regular http and websocket
function startServer(){
	app = express();
	server = http.createServer(app);
	app.use(express.compress());
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.set("view options", { layout: false });
	app.use('/static', express.static(__dirname + '/static'));
	app.use(express.json());
	app.use(express.urlencoded());
	app.use(cookieParser);
	app.use(express.session({ store: sessionStore }));
	app.use(passport.initialize());
	app.use(passport.session());
	app.use(app.router);
	defineAppRoutes();
	console.log('Miaou server starting on port', config.port);
	server.listen(config.port);
	ws.listen(server, sessionStore, cookieParser, db);
}

(function main() { // main
	db.init(config.database, startServer);
})();
