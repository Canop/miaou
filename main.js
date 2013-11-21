// https://github.com/jaredhanson/passport-google-oauth/tree/master/examples/oauth2
// https://code.google.com/apis/console/

var fs = require("fs"),
	express = require('express'),
	passport = require('passport'),
	util = require('util'),
	GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
  	jade = require('jade'),
	http = require('http'),
	config = eval('('+fs.readFileSync('config.json')+')'),
	mdb = require('./pgdb.js').init(config.database),
	loginutil = require('./login.js'),
	maxContentLength = config.maxMessageContentSize || 500,
	minDelayBetweenMessages = config.minDelayBetweenMessages || 5000,
	app,
	server;

passport.serializeUser(function(user, done) {
	console.log('serializeUser:', user);
	done(null, user.id);
});
passport.deserializeUser(function(id, done) {
	console.log('deserializeUser:', id);
	mdb.con(function(err, con){
		if (err) return done(new Error('no connection'));
		con.fetchUserById(id, function(err, user){
			if (err) { console.log('ERR:',err);return done(err); }
			con.ok();
			done(null, user);
		});
	});
});



console.log('config.googleOAuthParameters:', config.googleOAuthParameters);
// Use the GoogleStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Google
//   profile), and invoke a callback with a user object.
passport.use(new GoogleStrategy(config.googleOAuthParameters, function(accessToken, refreshToken, profile, done) {
	console.log("--------------GoogleStrategy callback--------------");
	//~ console.log(accessToken, refreshToken, profile);
	console.log('OAuth profile:', profile);
	mdb.con(function(err, con){
		if (err) return done(new Error('no connection'));
		con.fetchCompleteUserFromOAuthProfile(profile, function(err, user){
			if (err) { console.log('ERR:',err);return done(err); }
			con.ok();
			console.log('google profile changed into ', user);
			done(null, user);
		});
	});
}));

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
	console.log('ensureAuthenticated');
	if (req.isAuthenticated()) return next();
	res.redirect('/login');
}

// Checks that the profile is complete enough to be used for the chat
//  (a valid name is needed). If not, the user is redirected to the profile
//  page until he makes his profile complete.
function ensureCompleteProfile(req, res, next) {
	console.log('ensureCompleteProfile', req.user);
	console.log("IS VALID : ", loginutil.isValidUsername(req.user.name));
	if (loginutil.isValidUsername(req.user.name)) return next();
	res.redirect('/profile');
}

function startServer(){
	app = express();
	server = http.createServer(app),

	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.set("view options", { layout: false });
	app.use('/static', express.static(__dirname + '/static'));
	app.use(express.logger());
	app.use(express.cookieParser());
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.session({ secret: 'keyboard cat' }));
	// Initialize Passport!  Also use passport.session() middleware, to support
	// persistent login sessions (recommended).
	app.use(passport.initialize());
	app.use(passport.session());
	app.use(app.router);

	app.get('/', ensureAuthenticated, ensureCompleteProfile, function(req, res){
		console.log('**** get /', req.user);
		res.render('index.jade', { user: req.user });
	});
	app.get('/account', ensureAuthenticated, function(req, res){
		res.render('account.jade', { user: req.user });
	});
	app.get('/login', function(req, res){
		res.render('login.jade', { user: req.user });
	});
	app.get('/profile', function(req, res){
		console.log('GET /profile', req.user);
		res.render('profile.jade', { user: req.user });
	});

	// GET /auth/google
	//   Use passport.authenticate() as route middleware to authenticate the
	//   request.  The first step in Google authentication will involve
	//   redirecting the user to google.com.  After authorization, Google
	//   will redirect the user back to this application at /auth/google/callback
	app.get('/auth/google',
	  passport.authenticate('google', { scope: ['https://www.googleapis.com/auth/userinfo.profile',
												'https://www.googleapis.com/auth/userinfo.email'] }),
	  function(req, res){
		// The request will be redirected to Google for authentication, so this
		// function will not be called.
	  });

	// GET /auth/google/callback
	//   Use passport.authenticate() as route middleware to authenticate the
	//   request.  If authentication fails, the user will be redirected back to the
	//   login page.  Otherwise, the primary route function function will be called,
	//   which, in this example, will redirect the user to the home page.
	app.get('/auth/google/callback', 
	  passport.authenticate('google', { failureRedirect: '/login' }),
	  function(req, res) {
		res.redirect('/');
	  });

	app.get('/logout', function(req, res){
	  req.logout();
	  res.redirect('/');
	});


	app.get('/help', function(req, res){
		res.render('help.jade');
	});
	console.log('Miaou server starting on port', config.port);
	server.listen(config.port);

	io = require('socket.io').listen(server);
	io.set('log level', 1);
	io.sockets.on('connection', function (socket) {
		var user, room, lastMessageTime;
		function error(err){
			console.log('ERR', err, 'for user', user, 'in room', room);
			socket.emit('error', err.toString());
		}
		socket.on('enter', function (data) {
			if (data.user && data.user.name && /^\w[\w_\-\d]{2,19}$/.test(data.user.name) && data.room) {
				mdb.con(function(err, con){
					if (err) return error('no connection');
					con.fetchUser(data.user.name, function(err, u){
						if (err) return error(err);						
						user = u;
						socket.set('user', user);
						if (room) socket.leave(room.name);
						con.fetchRoom(data.room, function(err, r){
							if (err) return error(err);
							room = r;
							socket.emit('room', room) 
							socket.join(room.id);
							con.queryLastMessages(room.id, 300).on('row', function(message){
								socket.emit('message', message);
							}).on('end', function(){
								con.ok();
								socket.broadcast.to(room.id).emit('enter', user);
							});
							io.sockets.clients(room.id).forEach(function(s){
								s.get('user', function(err, u){
									if (err) console.log('missing user on socket', err);
									else socket.emit('enter', u);
								});
							});
						});
					});
				});
			} else {
				error('bad login');
			}
		}).on('message', function (content) {
			var now = Date.now();
			if (!(user && room)) {
				error('User or room not defined');
			} else if (content.length>maxContentLength) {
				error('Message too big, consider posting a link instead');
				console.log(content.length, maxContentLength);
			} else if (now-lastMessageTime<minDelayBetweenMessages) {
				error("You're too fast (minimum delay between messages : "+minDelayBetweenMessages+" ms)");
			} else {
				lastMessageTime = now;
				var m = { content: content, author: user.id, authorname: user.name, room: room.id, created: now/1000};
				//~ console.log(m);
				mdb.con(function(err, con){
					if (err) return error('no connection');
					con.storeMessage(m, function(err, m){
						if (err) return error(err);						
						con.ok();
						console.log("user ", user.name, 'send a message to', room);
						io.sockets.in(room.id).emit('message', m);
					});
				});
			}
		}).on('disconnect', function(){
			if (room) socket.broadcast.to(room.id).emit('leave', user);
		});
	});
}

(function main() { // main
	startServer();
	//loginutil.test();
})();
