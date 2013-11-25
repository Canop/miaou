var fs = require("fs"),
	http = require('http'),
	connect = require('connect'),
	express = require('express'),
	passport = require('passport'),
  	jade = require('jade'),
	socketio = require('socket.io'),
	SessionSockets = require('session.socket.io'),
	util = require('util'),
	GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
	config = JSON.parse(require('./config.json')),
	mdb = require('./pgdb.js').init(config.database),
	loginutil = require('./login.js'),
	maxContentLength = config.maxMessageContentSize || 500,
	minDelayBetweenMessages = config.minDelayBetweenMessages || 5000,
	cookieParser = express.cookieParser(config.secret),
	RedisStore = require('connect-redis')(express),
	sessionStore = new RedisStore({}),
	app, io, server;

passport.serializeUser(function(user, done) {
	done(null, user.id);
});
passport.deserializeUser(function(id, done) {
	mdb.con(function(err, con){
		if (err) return done(new Error('no connection'));
		con.fetchUserById(id, function(err, user){
			if (err) { console.log('ERR:',err);return done(err); }
			con.ok();
			done(null, user);
		});
	});
});

function url(pathname){ // todo cleaner way in express not supposing absolute paths ?
	return config.server+pathname;
}

var oauthParameters = config.googleOAuthParameters;
oauthParameters.callbackURL = url("/auth/google/callback");
passport.use(new GoogleStrategy(oauthParameters, function(accessToken, refreshToken, profile, done) {
	mdb.con(function(err, con){
		if (err) return done(new Error('no connection'));
		con.fetchCompleteUserFromOAuthProfile(profile, function(err, user){
			if (err) { console.log('ERR:',err);return done(err); }
			con.ok();
			done(null, user);
		});
	});
}));

function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) return next();
	res.redirect(url('/login'));
}

// Checks that the profile is complete enough to be used for the chat
//  (a valid name is needed). If not, the user is redirected to the profile
//  page until he makes his profile complete.
function ensureCompleteProfile(req, res, next) {
	if (loginutil.isValidUsername(req.user.name)) return next();
	res.redirect(url('/profile'));
}

// handles the socket, whose life should be the same as the presence of the user in a room without reload
function handleUserInRoom(socket, completeUser, room) {
	function error(err){
		console.log('ERR', err, 'for user', completeUser.name, 'in room', room.name);
		socket.emit('error', err.toString());
	}
	var lastMessageTime,
		publicUser = {id:completeUser.id, name:completeUser.name};

	socket.set('publicUser', publicUser);
	socket.emit('room', room);
	socket.join(room.id);
	mdb.con(function(err, con){
		if (err) return error('no connection');
		con.queryLastMessages(room.id, 300).on('row', function(message){
			socket.emit('message', message);
		}).on('end', function(){
			con.ok();
			socket.broadcast.to(room.id).emit('enter', publicUser);
		});
	});
	io.sockets.clients(room.id).forEach(function(s){
		s.get('publicUser', function(err, u){
			if (err) console.log('missing user on socket', err);
			else socket.emit('enter', u);
		});
	});

	socket.on('message', function (content) {
		var now = Date.now();
		if (content.length>maxContentLength) {
			error('Message too big, consider posting a link instead');
			console.log(content.length, maxContentLength);
		} else if (now-lastMessageTime<minDelayBetweenMessages) {
			error("You're too fast (minimum delay between messages : "+minDelayBetweenMessages+" ms)");
		} else {
			lastMessageTime = now;
			var m = { content: content, author: publicUser.id, authorname: publicUser.name, room: room.id, created: ~~(now/1000)};
			mdb.con(function(err, con){
				if (err) return error('no connection');
				con.storeMessage(m, function(err, m){
					if (err) return error(err);
					con.ok();
					console.log("user ", publicUser.name, 'send a message to', room.name);
					io.sockets.in(room.id).emit('message', m);
				});
			});
		}
	}).on('disconnect', function(){
		if (room) socket.broadcast.to(room.id).emit('leave', publicUser);
	});
}

// defines the routes to be taken by GET and POST requests
function defineAppRoutes(){
	
	app.get(/^\/(\d+)?$/, ensureAuthenticated, ensureCompleteProfile, function(req, res){
		var session = req.session, roomId = +req.params[0];
		if (roomId && (session.room==null || session.room.id != roomId)) {
			mdb.con(function(err, con){
				if (err) return new Error('no connection'); // fixme : send to error page
				con.fetchRoom(roomId, function(err, room){
					if (err) return die(err);
					con.ok();
					if (room) {
						session.room = room;
						res.render('index.jade', { user: JSON.stringify(req.user), room: JSON.stringify(session.room) });
					} else {
						res.redirect(url('/rooms'));
					}
				});
			});
		} else {
			res.render('index.jade', { user: JSON.stringify(req.user), room: JSON.stringify(session.room)||'null' });
		}
	});
	app.get('/login', function(req, res){
		res.render('login.jade', { user: req.user, authurl: url('/auth/google') });
	});
	app.get('/profile', function(req, res){
		res.render('profile.jade', {
			user: req.user,
			suggestedName: loginutil.isValidUsername(req.user.name) ? req.user.name : loginutil.suggestUsername(req.user.oauthdisplayname)
		});
	});
	app.post('/profile', function(req, res){
		var name = req.param('name');
		if (loginutil.isValidUsername(name)) {
			mdb.con(function(err, con){
				if (err) return new Error('no connection'); // fixme : send to error page
				req.user.name = name;
				con.updateUser(req.user, function(err){
					if (err) {
						console.log('error in update user', err);
						return; // fixme : what to do/render here ?
					}
					con.ok();
					res.redirect(url('/'));
				});
			});
		} else {
			res.render('profile.jade', { user: req.user });
		}
	});

	app.get('/auth/google',
		passport.authenticate(
			'google', { scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'] }
		)
	);
	
	app.get('/auth/google/callback',  // This is called by google back after authentication
		passport.authenticate('google', { failureRedirect: '/login' }),
		function(req, res) { res.redirect(url('/')) }
	);

	app.get('/rooms', function(req, res){
		mdb.con(function(err, con){
			if (err) return new Error('no connection'); // fixme : send to error page
			con.listPublicRooms(function(err, rooms){
				if (err) return; // fixme : what to do/render here ?
				con.ok();
				console.log('rooms:', rooms);
				res.render('rooms.jade', { rooms: rooms });
			});
		});
	});

	app.get('/logout', function(req, res){
		req.logout();
		res.redirect(url('/'));
	});

	app.get('/help', function(req, res){
		res.render('help.jade');
	});
}

// starts the whole server, both regular http and websocket
function startServer(){
	app = express();
	server = http.createServer(app),

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

	io = socketio.listen(server);
	io.set('log level', 1);
	
	var sessionSockets = new SessionSockets(io, sessionStore, cookieParser);
	sessionSockets.on('connection', function (err, socket, session) {
		function die(err){
			console.log('ERR', err);
			socket.emit('error', err.toString());
			socket.disconnect();
		}
		if (! (session && session.passport && session.passport.user && session.room)) return die ('invalid session');
		var userId = session.passport.user;
		if (!userId) return die('no authenticated user in session');
		mdb.con(function(err, con){
			if (err) return die(err);
			con.fetchUserById(userId, function(err, completeUser){
				if (err) return die(err);
				con.ok();
				handleUserInRoom(socket, completeUser, session.room);
			});
		});
	});
}

(function main() { // main
	startServer();
})();
