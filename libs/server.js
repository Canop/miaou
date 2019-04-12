const	http = require('http'),
	path = require('path'),
	express = require('express'),
	bodyParser = require('body-parser'),
	passport = require('passport'),
	login = require('./login.js'),
	db = require('./db.js'),
	naming = require('./naming.js'),
	session = require('express-session'),
	oauth2Strategies = {},
	mobileRegex = /Android|webOS|iPhone|iPad|Mini/i;

var	miaou, // properties : db, config, bot, io
	baseURL,
	app,
	server;

passport.serializeUser(function(user, done){
	done(null, user.id);
});

passport.deserializeUser(function(id, done){
	db.on(id)
	.then(db.getUserById)
	.then(function(user){
		done(null, user)
	})
	.catch(done)
	.finally(db.off);
});

function configureOauth2Strategies(){
	var impls = {
		google: {
			strategyConstructor: require('@passport-next/passport-google-oauth2').Strategy,
			scope: [ 'profile', 'email' ]
		},
		stackexchange: {
			strategyConstructor: require('./passport-stackexchange.js').Strategy
		},
		github: {
			strategyConstructor: require('passport-github2').Strategy
		},
		reddit: {
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
		passport.use(new (impl.strategyConstructor)(params, function(accessToken, refreshToken, profile, done){
			db.on(profile)
			.then(db.getCompleteUserFromOAuthProfile)
			.then(function(user){
				done(null, user)
			})
			.catch(function(err){
				console.log('ERR in passport:', err);
				done(err);
			}).finally(db.off);
		}));
		oauth2Strategies[key] = { url:url('/auth/'+key), scope:impl.scope||{} };
	}
	login.setOauth2Strategies(oauth2Strategies);
}

// define the routes to be taken by GET and POST requests
async function defineAppRoutes(){
	var	auths = miaou.lib("auths"),
		rooms = miaou.lib('rooms'),
		tags = miaou.lib('tags'),
		messages = miaou.lib('messages'),
		pings = miaou.lib('pings'),
		upload = miaou.lib('upload'),
		clienterrors = miaou.lib('clienterrors'),
		profile = miaou.lib('profile'),
		chat = miaou.lib('chat'),
		help = miaou.lib('help'),
		legal = miaou.lib('legal'),
		intro = miaou.lib('intro'),
		webPush = miaou.lib("web-push"),
		prefs = miaou.lib('prefs');
	await auths.init();
	function ensureAuthenticated(req, res, next){
		if (req.isAuthenticated()) return next();
		var roomId = req.params[0];
		res.redirect(url(roomId ? '/login?room=' + roomId : '/login'));
	}
	function ensureCompleteProfile(req, res, next){
		if (naming.isValidUsername(req.user.name)) return next();
		res.redirect(url('/username'));
	}
	function map(verb, path, fun, noNeedForCompleteProfile, noNeedForLogin){
		var args = [path];
		if (!noNeedForLogin) args.push(ensureAuthenticated);
		if (!noNeedForCompleteProfile) args.push(ensureCompleteProfile);
		args.push(fun);
		app[verb](...args);
	}
	for (var key in oauth2Strategies) {
		var s = oauth2Strategies[key];
		app.get(
			'/auth/'+key,
			passport.authenticate(key, {scope:s.scope, state:'Ohio', duration:'permanent'})
		);
		app.get(
			'/auth/'+key+'/callback',
			passport.authenticate(key, { failureRedirect: '/login' }),
			function(req, res){
				res.redirect(url())
			}
		);
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
	map('get', '/json/stringToMD5', prefs.appGetJsonStringToMD5);
	map('get', '/publicProfile', profile.appGetPublicProfile, true, true);
	map('get', /^\/user\/([\w-]+)$/, profile.appGetUser, true, true);
	map('get', '/help', help.appGetHelp, true, true);
	map('get', '/helpus', help.appGetHelpUs, true, true);
	map('get', '/legal', legal.appGetLegal, true, true);
	map('get', '/intro', intro.appGetIntro, true, true);
	map('post', '/upload', upload.appPostUpload, true);
	map('post', '/error', clienterrors.appPostError, true, true);
	map('get', '/json/tags', tags.appGetJsonTags);
	map('get', '/json/tag', tags.appGetJsonTag);
	map('get', '/json/rooms', rooms.appGetJsonRooms);
	map('get', '/json/room', rooms.appGetJsonRoom);
	map('get', '/json/user', profile.appGetJsonUser);
	map('get', '/json/messages/last', messages.appGetJsonLastMessages);
	map('get', '/json/pings', pings.appGetJsonPings);
	map('get', '/vapidPublicKey', webPush.appGetVapidPublicKey); // FIXME send in page locals
	map('get', '/sw.js', webPush.appGetSW);

	miaou.plugins.forEach(function(p){
		if (p.registerRoutes) p.registerRoutes(map);
	});
}

// starts the whole server, both regular http and websocket
async function startServer(){
	miaou.lib("naming");
	miaou.lib("throttler");

	var	cookieParser = require('cookie-parser')(miaou.config.secret),
		RedisStore = require('connect-redis')(session),
		sessionStore = new RedisStore(miaou.config.redisStore || {});
	app = express();
	server = http.createServer(app);
	app.disable('x-powered-by');
	app.use(require('compression')());
	app.set("trust proxy", !!miaou.config.trustProxy);
	app.set('views', path.resolve(__dirname, '..', 'views'));
	app.set('view engine', 'pug');
	app.set("view options", { layout: false });
	app.use('/static', express.static(path.resolve(__dirname, '..', 'static')));
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({ extended:false }));
	app.use(cookieParser);
	app.use(session({
		store: sessionStore, secret: miaou.config.secret,
		saveUninitialized: true, resave: false
	}));
	app.use(passport.initialize());
	app.use(passport.session());

	miaou.plugins.forEach(function(p){
		if (p.appuse) app.use(p.appuse);
	});

	var anticsrf = require('./anti-csrf.js');
	anticsrf.whitelist('/upload');
	anticsrf.whitelist('/error');
	app.use(anticsrf.filter);

	app.use(function(req, res, next){
		res.set("X-Frame-Options", "deny");
		res.set("Content-Security-Policy", "script-src 'self'");
		res.set("Cache-Control", "no-transform");
		next();
	});

	let defaultTheme = miaou.config.themes[0];
	app.locals.theme = defaultTheme;
	app.locals.inlineJSON = function(obj){
		var json = JSON.stringify(obj);
		return json.replace(/<([/!])/g, '\\u003c$1');
	};

	await defineAppRoutes();
	var port = miaou.config.port;
	console.log('Miaou server starting on port', port);
	server.listen(port);
	miaou.lib("ws").listen(server, sessionStore, cookieParser);
}

var url = exports.url = function(pathname){
	return baseURL+(pathname||'/');
}

exports.roomPath = function(room){
	return room.id+'?'+naming.toUrlDecoration(room.name);
}
exports.roomUrl = function(room){
	return url('/'+exports.roomPath(room));
}
exports.mobile = function(req){
	return mobileRegex.test(req.headers['user-agent']);
}

exports.renderErr = function(req, res, err, base){
	console.log(err);
	res.render('error.pug', { // FIXME tester
		vars: {
			me: req.user
		},
		base:base||'',
		error:err.toString()
	});
}

exports.start = async function(config){
	process.on('unhandledRejection', (reason, p) => {
		console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
	});
	baseURL = config.server;
	miaou = require("./Miaou.js")(config, db);
	await db.init(config)
	await miaou.initBot()
	await miaou.initPlugins()
	configureOauth2Strategies();
	await startServer();
}

exports.stop = function(cb){
	console.log("Miaou stops");
	if (cb) cb();
}
