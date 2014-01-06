var fs = require("fs"),
	http = require('http'),
	connect = require('connect'),
	express = require('express'),
	passport = require('passport'),
  	jade = require('jade'),
	socketio = require('socket.io'),
	util = require('util'),
	config = require('./config.json'),
	mdb = require('./pgdb.js'),
	loginutil = require('./login.js'),
	ws = require('./ws.js'),
	cookieParser = express.cookieParser(config.secret),
	RedisStore = require('connect-redis')(express),
	oauth2Strategies = {},
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
	return config.server+(pathname||'/');
}
function roomPath(room){
	return room.id+'?'+loginutil.toUrlDecoration(room.name);	
}
function roomUrl(room){
	return url('/'+roomPath(room));
}

(function configureOauth2Strategies(){
	var impls = {
		google: {
			strategyConstructor: require('passport-google-oauth').OAuth2Strategy,
			scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email']
		}, stackexchange: {
			strategyConstructor: require('passport-stackexchange').Strategy
		}, github: {
			strategyConstructor: require('passport-github').Strategy
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
			mdb.con(function(err, con){
				if (err) return done(new Error('no connection'));
				con.fetchCompleteUserFromOAuthProfile(profile, function(err, user){
					if (err) { console.log('ERR:',err);return done(err); }
					con.ok();
					done(null, user);
				});
			});
		}));
		oauth2Strategies[key] = { url: url('/auth/'+key), scope: impl.scope||{} };
	}
})();

function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) return next();
	var roomId = req.params[0];
	res.redirect(url(roomId ? '/login?room=' + roomId : '/login'));
}

// Checks that the profile is complete enough to be used for the chat
//  (a valid name is needed). If not, the user is redirected to the profile
//  page until he makes his profile complete.
function ensureCompleteProfile(req, res, next) {
	if (loginutil.isValidUsername(req.user.name)) return next();
	res.redirect(url('/profile'));
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

function checkAuthAtLeast(auth, neededAuth) {
	var levels = ['read', 'write', 'admin', 'own'];
	for (var i=levels.length; i-->0;) {
		if (levels[i]===auth) return true;
		if (levels[i]===neededAuth) return false;
	}
	return false;
}

// defines the routes to be taken by GET and POST requests
function defineAppRoutes(){
	
	app.get(/^\/(\d+)?$/, ensureAuthenticated, ensureCompleteProfile, function(req, res){
		withRoom(+req.params[0], req.user.id, function(err, room) {
			if (!room) return res.redirect(url('/rooms'));		
			req.session.room = room;
			if (!room.private) {
				return res.render('chat.jade', { user:JSON.stringify(req.user), room:JSON.stringify(room) });
			}
			mdb.con(function(err, con){
				con.checkAuthLevel(room.id, req.user.id, 'write', function(err, auth){
					if (auth) res.render('chat.jade', { user:JSON.stringify(req.user), room:JSON.stringify(room) });
					else res.render('request.jade', { room:room });
					con.ok();
				});
			});
		});
	});
	
	app.get('/login', function(req, res){
		res.render('login.jade', { user:req.user, oauth2Strategies:oauth2Strategies });
	});
	
	app.get('/profile', function(req, res){
		res.render('profile.jade', {
			user: req.user,
			suggestedName: loginutil.isValidUsername(req.user.name) ? req.user.name : loginutil.suggestUsername(req.user.oauthdisplayname)
		});
	});
	app.post('/profile', ensureAuthenticated, function(req, res){
		var name = req.param('name');
		if (loginutil.isValidUsername(name)) {
			mdb.con(function(err, con){
				if (err) return res.render('error.jade', { error:err.toString() });
				req.user.name = name;
				con.updateUser(req.user, function(err){
					if (err) return res.render('error.jade', { error: err.toString() });
					con.ok();
					res.redirect(url());
				});
			});
		} else {
			res.render('profile.jade', { user: req.user });
		}
	});

	for (key in oauth2Strategies){
		var s = oauth2Strategies[key];
		app.get('/auth/'+key, passport.authenticate(key, {scope:s.scope}));
		app.get('/auth/'+key+'/callback', passport.authenticate(key, { failureRedirect: '/login' }), function(req, res) { res.redirect(url()) });		
	};

	app.get('/room', ensureAuthenticated, ensureCompleteProfile, function(req, res){
		withRoom(+req.param('id'), req.user.id, function(err, room) {
			if (!room) return res.render('room.jade', { room: "null", error: "null" });
			mdb.con(function(err, con){
				con.checkAuthLevel(room.id, req.user.id, 'admin', function(err, auth){
					if (auth) res.render('room.jade', { room: JSON.stringify(room), error: "null" });
					else res.render('error.jade', { error: "Admin level is required to manage the room" });
				});
			});
		});
	});
	app.post('/room', ensureAuthenticated, ensureCompleteProfile, function(req, res){		
		var roomId = +req.param('id'), name = req.param('name').trim();
		if (!/^.{2,20}$/.test(name)) {
			return res.render('error.jade', { error: err.toString() });
		}
		mdb.con(function(err, con){
			if (err) return res.render('error.jade', { error: err.toString() });
			var room = {id:roomId, name: name, private:req.param('private')||false, description:req.param('description')};
			con.storeRoom(room, req.user, function(err){
				if (err) return res.render('room.jade', { room: JSON.stringify(room), error: JSON.stringify(err.toString()) });
				con.ok();
				res.redirect(roomUrl(room));
			});
		});
	});
	
	app.get('/auths', ensureAuthenticated, ensureCompleteProfile, function(req, res){
		withRoom(+req.param('id'), req.user.id, function(err, room) {
			if (!room) return res.render('error.jade', { error: "No room" });
			room.path = roomPath(room)
			mdb.con(function(err, con){
				if (err) return res.render('error.jade', { error: "No connection" });
				con.listRoomAuths(room.id, function(err, auths){
					if (err) return res.render('error.jade', { error: err.toString() });
					con.listOpenAccessRequests(room.id, function(err, requests){
						if (err) return res.render('error.jade', { error: err.toString() });
						con.listRecentUsers(room.id, 50, function(err, recentUsers){
							if (err) return res.render('error.jade', { error: err.toString() });
							var authorizedUsers = {}, unauthorizedUsers = [];
							auths.forEach(function(a){
								authorizedUsers[a.player] = true;
							});
							recentUsers.forEach(function(u){
								if (!authorizedUsers[u.id]) unauthorizedUsers.push(u);
							});
							con.ok();
							res.render('auths.jade', { room:room, auths:auths, requests:requests, unauthorizedUsers:unauthorizedUsers });
						});
					});
				});
			});
		});
	});
	app.post('/auths', ensureAuthenticated, ensureCompleteProfile, function(req, res){
		withRoom(+req.param('room'), req.user.id, function(err, room) {
			if (!room) return res.render('error.jade', { error: "No room" });
			if (!checkAuthAtLeast(room.auth, 'admin')) return res.render('error.jade', { error: "Admin auth is required" });
			mdb.con(function(err, con){
				if (err) return res.render('error.jade', { error: "No connection" });
				var m, actions = [];
				for (var key in req.body){
					if (m = key.match(/^answer_request_(\d+)$/)) {
						var accepted = req.body[key]==='grant', modifiedUserId = +m[1];
						if (accepted) actions.push({cmd:'insert_auth', auth:'write', user:modifiedUserId});
						ws.emitAccessRequestAnswer(room.id, modifiedUserId, accepted);
						actions.push({cmd:'delete_ar', user:modifiedUserId});
					} else if (m = key.match(/^insert_auth_(\d+)$/)) {
						actions.push({cmd:'insert_auth', auth:req.body[key], user:+m[1]});
					} else if (m = key.match(/^change_auth_(\d+)$/)) {
						var new_auth = req.body[key], modifiedUserId = +m[1];
						if (new_auth==='none') actions.push({cmd:'delete_auth', user:modifiedUserId});
						else actions.push({cmd:'update_auth', user:modifiedUserId, auth:new_auth});
					}
				}
				con.changeRights(actions, req.user.id, room, function(){
					if (err) return res.render('error.jade', { error: err.toString() });
					res.redirect(roomUrl(room));
				});
			});
		});
	});

	app.get('/rooms', ensureAuthenticated, ensureCompleteProfile, function(req, res){
		mdb.con(function(err, con){
			if (err) return res.render('error.jade', { error: "No connection" });
			con.listAccessibleRooms(req.user.id, function(err, accessibleRooms){
				if (err) return res.render('error.jade', { error: err.toString() });
				var rooms = {public:[], private:[]};
				accessibleRooms.forEach(function(r) {
					r.path = roomPath(r);
					rooms[r.private?'private':'public'].push(r);
				});
				con.fetchUserPingRooms(req.user.id, 0, function(err, pings) {
					if (err) return res.render('error.jade', { error: err.toString() });
					con.ok();
					res.render('rooms.jade', { rooms:rooms, pings:pings });
				});
			});
		});
	});

	app.get('/logout', function(req, res){
		console.log('User ' + req.user.id + ' log out');
		req.logout();
		res.redirect(url());
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

	ws.listen(server, sessionStore, cookieParser, mdb);
}

(function main() { // main
	mdb.init(config.database, startServer);
})();
