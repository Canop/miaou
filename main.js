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
	config = require('./config.json'),
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
// Implementation details :
//  - we don't pick the room in the session because it may be incorrect when the user has opened tabs in
//     different rooms and there's a reconnect
function handleUserInRoom(socket, completeUser) {
	function error(err){
		console.log('ERR', err, 'for user', completeUser.name, 'in room', (room||{}).name);
		socket.emit('error', err.toString());
	}
	var room, lastMessageTime,
		publicUser = {id:completeUser.id, name:completeUser.name};

	console.log('starting handling new socket for', completeUser.name);

	socket.set('publicUser', publicUser);
	socket.on('enter', function(roomId){
		console.log(publicUser.name, 'enters', roomId);
		mdb.con(function(err, con){
			if (err) return error('no connection'); // todo kill everything
			con.fetchRoomAndUserAuth(roomId, publicUser.id, function(err, r){
				if (err) return error(err);
				// todo handle missing room
				room = r;
				socket.emit('room', room);
				socket.join(room.id);
				con.queryLastMessages(room.id, 300).on('row', function(message){
					socket.emit('message', message);
				}).on('end', function(){
					con.ok();
					socket.broadcast.to(room.id).emit('enter', publicUser);
				});
				io.sockets.clients(room.id).forEach(function(s){
					s.get('publicUser', function(err, u){
						if (err) console.log('missing user on socket', err);
						else socket.emit('enter', u);
					});
				});
			});			
		});
	}).on('message', function (message) {
		if (!room) {
			socket.emit('get_room', message);
			return;
		}
		var now = Date.now(), seconds = ~~(now/1000), content = message.content;
		if (content.length>maxContentLength) {
			error('Message too big, consider posting a link instead');
			console.log(content.length, maxContentLength);
		} else if (now-lastMessageTime<minDelayBetweenMessages) {
			error("You're too fast (minimum delay between messages : "+minDelayBetweenMessages+" ms)");
		} else {
			lastMessageTime = now;
			var m = { content: content, author: publicUser.id, authorname: publicUser.name, room: room.id};
			if (message.id) {
				m.id = message.id;
				m.changed = seconds;				
			} else {
				m.created = seconds;				
			}
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
		console.log(completeUser.name, "disconnected");
		if (room) socket.broadcast.to(room.id).emit('leave', publicUser);
	});
}

// calls the callback with the room given by roomId or null
function withRoom(roomId, userId, cb){
	if (!roomId) return cb(null, null);
	mdb.con(function(err, con){
		if (err) cb(new Error('no connection'));
		con.fetchRoomAndUserAuth(roomId, userId, function(err, room){
			if (err) return cb(err);
			con.ok();
			cb(null, room);
		});
	});
}

// defines the routes to be taken by GET and POST requests
function defineAppRoutes(){
	
	app.get(/^\/(\d+)?$/, ensureAuthenticated, ensureCompleteProfile, function(req, res){
		withRoom(+req.params[0], req.user.id, function(err, room) {
			if (room) {
				req.session.room = room;
				res.render('index.jade', { user: JSON.stringify(req.user), room: JSON.stringify(room) });
			} else {
				res.redirect(url('/rooms'));			
			}
		});
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
	app.post('/profile', ensureAuthenticated, ensureCompleteProfile, function(req, res){
		var name = req.param('name');
		if (loginutil.isValidUsername(name)) {
			mdb.con(function(err, con){
				if (err) return res.render('error.jade', { error: err.toString() });
				req.user.name = name;
				con.updateUser(req.user, function(err){
					if (err) return res.render('error.jade', { error: err.toString() });
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

	app.get('/room', ensureAuthenticated, ensureCompleteProfile, function(req, res){
		withRoom(+req.param('id'), req.user.id, function(err, room) {
			res.render('room.jade', { room: JSON.stringify(room), error: "null" });
		});
	});
	app.post('/room', ensureAuthenticated, ensureCompleteProfile, function(req, res){		
		var roomId = +req.param('id'), name = req.param('name');
		if (!/^\w(\s?[\w\d\-_]){2,15}$/.test(name)) {
			return; // todo error message
		}
		mdb.con(function(err, con){
			if (err) return res.render('error.jade', { error: err.toString() });
			var room = {id:roomId, name: name, private:req.param('private')||false, description:req.param('description')};
			console.log('post room:', room);
			con.storeRoom(room, req.user, function(err){
				if (err) {
					console.log('error in update or create room', err);
					res.render('room.jade', { room: JSON.stringify(room), error: JSON.stringify(err.toString()) });
					return;
				}
				con.ok();
				res.redirect(url('/'+room.id));
			});
		});
	});

	app.get('/rooms', ensureAuthenticated, ensureCompleteProfile, function(req, res){
		mdb.con(function(err, con){
			if (err) return new Error('no connection'); // fixme : send to error page
			con.listPublicRooms(function(err, publicRooms){
				if (err) return res.render('error.jade', { error: err.toString() });
				con.listUserRoomAuths(req.user.id, function(err, userRooms){
					if (err) return res.render('error.jade', { error: err.toString() });
					con.ok();
					res.render('rooms.jade', { publicRooms:publicRooms, userRooms:userRooms });
				});
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
				handleUserInRoom(socket, completeUser);
			});
		});
	});
}

(function main() { // main
	startServer();
})();
