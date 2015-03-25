"use strict";

const fs = require("fs"),
	http = require('http'),
	path = require('path'),
	express = require('express'),
	bodyParser = require('body-parser'),
	passport = require('passport'),
	login = require('./login.js'),
	db = require('./db.js'),
	naming = require('./naming.js'),
	session = require('express-session'),
	RedisStore = require('connect-redis')(session),
	sessionStore = new RedisStore({}),
	oauth2Strategies = {},
	mobileRegex = /Android|webOS|iPhone|iPad|Mini/i;

var	miaou, // properties : db, config, bot
	baseURL,
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

function configureOauth2Strategies(){
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
	var oauthConfigs = miaou.config.oauth2;
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
function defineAppRoutes(){
	var auths = require('./auths.js'),
		rooms = require('./rooms.js').configure(miaou),
		messages = require('./messages.js'),
		upload = require('./upload.js').configure(miaou),
		clienterrors = require('./clienterrors.js').configure(miaou),
		profile = require('./profile.js').configure(miaou),
		chat = require('./chat.js').configure(miaou),
		help = require('./help.js'),
		intro = require('./intro.js'),
		prefs = require('./prefs.js').configure(miaou);
	function ensureAuthenticated(req, res, next) {
		if (req.isAuthenticated()) return next();
		var roomId = req.params[0];
		res.redirect(url(roomId ? '/login?room=' + roomId : '/login'));
	}
	function ensureCompleteProfile(req, res, next) {
		if (naming.isValidUsername(req.user.name)) return next();
		res.redirect(url('/username'));
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
	map('post', '/rooms', rooms.appPostRooms);
	map('get', '/auths', auths.appGetAuths);
	map('post', '/auths', auths.appPostAuths);
	map('all', '/username', profile.appAllUsername, true);
	map('all', '/prefs', prefs.appAllPrefs, true);
	map('get', '/publicProfile', profile.appGetPublicProfile, true, true);
	map('get', /^\/user\/(\w+)$/, profile.appGetUser, true, true);
	map('get', '/help', help.appGetHelp, true, true);
	map('get', '/helpus', help.appGetHelpUs, true, true);
	map('get', '/intro', intro.appGetIntro, true, true);
	map('post', '/upload', upload.appPostUpload, true);
	map('post', '/error', clienterrors.appPostError, true, true);
	map('get', '/json/rooms', rooms.appGetJsonRooms);
	map('get', '/json/messages/last', messages.appGetJsonLastMessages, true, true);
}

// starts the whole server, both regular http and websocket
function startServer(){
	naming.configure(miaou);

	var cookieParser = require('cookie-parser')(miaou.config.secret);
	app = express();
	server = http.createServer(app);
	app.disable('x-powered-by');
	app.use(require('compression')());
	app.set('views', path.resolve(__dirname, '..', 'views'));
	app.set('view engine', 'jade');
	app.set("view options", { layout: false });
	app.use('/static', express.static(path.resolve(__dirname, '..', 'static')));
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({ extended:false }));
	app.use(cookieParser);
	app.use(session({
		store: sessionStore, secret: miaou.config.secret, saveUninitialized: true, resave: true /* todo test resave false */
	}));
	app.use(passport.initialize());
	app.use(passport.session());
	app.use(require('./anti-csrf.js')({ whitelist:['/upload', '/error'] }));
	
	app.use(function(req, res, next) {
		res.set("X-Frame-Options", "deny");
		res.set("Content-Security-Policy", "script-src 'self'");
		res.set("Cache-Control", "no-transform");
		return next();
	});
	
	app.locals.theme = miaou.config.themes[0]; // default theme
	
	defineAppRoutes();
	var port = miaou.config.port;
	console.log('Miaou server starting on port', port);
	server.listen(port);
	require('./ws.js').configure(miaou).listen(server, sessionStore, cookieParser);
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

function initPlugins(){
	(miaou.config.plugins||[]).forEach(function(n){
		var	pluginfilepath = path.resolve(__dirname, '..', n),
			plugin = require(pluginfilepath);
		if (plugin.init) plugin.init(miaou, path.dirname(pluginfilepath));
	});
}

exports.start = function(config){
	baseURL = config.server;
	miaou = {
		db:db,
		config:config
	};
	db.init(config, function(){
		db.on("miaou")
		.then(db.getBot)
		.then(function(b){
			miaou.bot = b;
 			if (config.botAvatar.src!==b.avatarsrc || config.botAvatar.key!==b.avatarkey) {
				console.log("config.botAvatar.src:",config.botAvatar.src);
				console.log("b.avatarsrc:",b.avatarsrc);
				console.log("config.botAvatar.key:",config.botAvatar.key);
				console.log("b.avatarkey:",b.avatarkey);
				b.avatarsrc = config.botAvatar.src;
				b.avatarkey = config.botAvatar.key;
				return this.updateUser(b)
			}
		})
		.finally(db.off)
		.then(function(){
			configureOauth2Strategies();
			startServer();
			initPlugins();
		});		
	});
}

exports.stop = function(cb){
	console.log("Miaou stops");
	if (cb) cb();
}
