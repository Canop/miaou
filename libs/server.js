var fs = require("fs"),
	http = require('http'),
	path = require('path'),
	express = require('express'),
	passport = require('passport'),
	login = require('./login.js'),
	db = require('./db.js'),
	naming = require('./naming.js'),
	baseURL,
	RedisStore = require('connect-redis')(express),
	sessionStore = new RedisStore({}),
	oauth2Strategies = {},
	mobileRegex = /Android|webOS|iPhone|iPad|Mini/i,
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

function configureOauth2Strategies(config){
	var impls = {
		google: {
			strategyConstructor: require('passport-google-oauth').OAuth2Strategy,
			scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email']
		}, stackexchange: {
			strategyConstructor: require('./passport-stackexchange.js').Strategy
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
		params.callbackURL = url("/auth/"+key+"/callback");
		passport.use(new (impl.strategyConstructor)(params, function(accessToken, refreshToken, profile, done) {			
			db.on(profile)
			.then(db.getCompleteUserFromOAuthProfile)
			.then(function(user){ done(null, user) })
			.catch(function(err){
				console.log('ERR in passport:',err);
				done(err);
			}).finally(db.off);
		}));
		oauth2Strategies[key] = { url:url('/auth/'+key), scope:impl.scope||{} };
	}
	login.setOauth2Strategies(oauth2Strategies);
}

// defines the routes to be taken by GET and POST requests
function defineAppRoutes(config){
	var auths = require('./auths.js'),
		rooms = require('./rooms.js').configure(config),
		upload = require('./upload.js').configure(config),
		profile = require('./profile.js').configure(config),
		chat = require('./chat.js').configure(config),
		help = require('./help.js'),
		intro = require('./intro.js');
	function ensureAuthenticated(req, res, next) {
		if (req.isAuthenticated()) return next();
		var roomId = req.params[0];
		res.redirect(url(roomId ? '/login?room=' + roomId : '/login'));
	}
	function ensureCompleteProfile(req, res, next) {
		if (naming.isValidUsername(req.user.name)) return next();
		res.redirect(url('/profile'));
	}
	function map(verb, path, fun, noNeedForCompleteProfile, noNeedForLogin){
		var args = [path];
		if (!noNeedForLogin) args.push(ensureAuthenticated);
		if (!noNeedForCompleteProfile) args.push(ensureCompleteProfile);
		args.push(fun.length<=2 ? fun : function(req, res){ fun(req, res, db) });
		app[verb].apply(app, args);
	}
	for (var key in oauth2Strategies){
		var s = oauth2Strategies[key];
		app.get('/auth/'+key, passport.authenticate(key, {scope:s.scope, state:'Ohio', duration:'permanent'}));
		app.get('/auth/'+key+'/callback', passport.authenticate(key, { failureRedirect: '/login' }), function(req, res) { res.redirect(url()) });		
	}
	map('get', '/login', login.appGetLogin, true, true);
	map('get', '/logout', login.appGetLogout, true, true);
	map('get', /^\/(\d+)?$/, chat.appGet);
	map('get', '/room', rooms.appGetRoom);
	map('post', '/room', rooms.appPostRoom);
	map('get', '/rooms', rooms.appGetRooms);
	map('get', '/auths', auths.appGetAuths);
	map('post', '/auths', auths.appPostAuths);
	map('all', '/username', profile.appAllUsername, true);
	map('all', '/profile', profile.appAllProfile, true);
	map('get', '/publicProfile', profile.appGetPublicProfile, true, true);
	map('get', /^\/user\/(\d+)$/, profile.appGetUser, true, true);
	map('get', '/help', help.appGetHelp, true, true);
	map('get', '/helpus', help.appGetHelpUs, true, true);
	map('get', '/intro', intro.appGetIntro, true, true);
	map('post', '/upload', upload.appPostUpload, true);
}

// starts the whole server, both regular http and websocket
function startServer(config){
	var cookieParser = express.cookieParser(config.secret);
	app = express();
	server = http.createServer(app);
	app.use(express.compress());
	app.set('views', path.resolve(__dirname, '..', 'views'));
	app.set('view engine', 'jade');
	app.set("view options", { layout: false });
	app.use('/static', express.static(path.resolve(__dirname, '..', 'static')));
	app.use(express.json());
	app.use(express.urlencoded());
	app.use(cookieParser);
	app.use(express.session({ store: sessionStore }));
	app.use(passport.initialize());
	app.use(passport.session());
	app.use(require('./anti-csrf.js')({whitelist:['/upload']}));
	app.use(app.router);
	defineAppRoutes(config);
	console.log('Miaou server starting on port', config.port);
	server.listen(config.port);
	require('./ws.js').configure(config, db).listen(server, sessionStore, cookieParser, db);
}

var url = exports.url = function(pathname){ // todo cleaner way in express not supposing absolute paths ?
	return baseURL+(pathname||'/');
}

var roomPath = exports.roomPath = function(room){
	return room.id+'?'+naming.toUrlDecoration(room.name);	
}
var roomUrl = exports.roomUrl = function(room){
	return exports.url('/'+exports.roomPath(room));
}
exports.mobile = function(req){
	return mobileRegex.test(req.headers['user-agent']);
}
exports.renderErr = function(res, err, base){
	console.log(err);
	res.render('error.jade', { base:base||'', error: err.toString() });
}

function initPlugins(config){
	(config.plugins||[]).map(function(n){
		return require(path.resolve(__dirname, '..', n))
	}).forEach(function(p){
		if (p.init) p.init(config, db);
	});
}

exports.start = function(config){
	baseURL = config.server;
	db.init(config.database, function(){
		configureOauth2Strategies(config);
		startServer(config);
		initPlugins(config);
	});
}
