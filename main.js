var fs = require("fs"),
	http = require('http'),
	connect = require('connect'),
	express = require('express'),
	passport = require('passport'),
	jade = require('jade'),
	socketio = require('socket.io'),
	util = require('util'),
	config = require('./config.json'),
	db = require('./pgdb.js'),
	loginutil = require('./login.js'),
	ws = require('./ws.js'),
	cookieParser = express.cookieParser(config.secret),
	RedisStore = require('connect-redis')(express),
	oauth2Strategies = {},
	sessionStore = new RedisStore({}),
	mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|Mini/i,
	app, io, server;

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
		}, reddit: {
			strategyConstructor: require('passport-reddit').Strategy			
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

var levels = ['read', 'write', 'admin', 'own'];
function checkAuthAtLeast(auth, neededAuth) {
	for (var i=levels.length; i-->0;) {
		if (levels[i]===auth) return true;
		if (levels[i]===neededAuth) return false;
	}
	return false;
}

function mobile(req){
	return mobileRegex.test(req.headers['user-agent']);
}

// defines the routes to be taken by GET and POST requests
function defineAppRoutes(){
	
	app.get(/^\/(\d+)?$/, ensureAuthenticated, ensureCompleteProfile, function(req, res){
		db.on([+req.params[0], req.user.id])
		.spread(db.fetchRoomAndUserAuth)
		.then(function(room){
			req.session.room = room;
			if (room.private && !checkAuthAtLeast(room.auth, 'write')) {
				return res.render('request.jade', { room:room });
			}
			console.log(req.user.name, 'user-agent:', req.headers['user-agent']);
			res.render(mobile(req) ? 'chat.mob.jade' : 'chat.jade', { user:JSON.stringify(req.user), room:JSON.stringify(room) });
		}).catch(db.NoRowError, function(err){
			// not an error as it happens when there's no room id in url
			res.redirect(url('/rooms'));
		}).finally(db.off);
	});
	
	app.get('/login', function(req, res){
		res.render('login.jade', { user:req.user, oauth2Strategies:oauth2Strategies });
	});
	
	app.get('/profile', function(req, res){
		res.render('profile.jade', {
			user: req.user,
			suggestedName: loginutil.isValidUsername(req.user.name) ? req.user.name : loginutil.suggestUsername(req.user.oauthdisplayname || '')
		});
	});
	app.post('/profile', ensureAuthenticated, function(req, res){
		var name = req.param('name');
		if (loginutil.isValidUsername(name)) {
			req.user.name = name;
			db.on(req.user)
			.then(db.updateUser)
			.then(function(){ res.redirect(url()); })
			.finally(db.off);
		} else {
			res.render('profile.jade', { user: req.user });
		}
	});

	for (var key in oauth2Strategies){
		var s = oauth2Strategies[key];
		app.get('/auth/'+key, passport.authenticate(key, {scope:s.scope, state:'Ohio', duration:'permanent'}));
		app.get('/auth/'+key+'/callback', passport.authenticate(key, { failureRedirect: '/login' }), function(req, res) { res.redirect(url()) });		
	};

	app.get('/room', ensureAuthenticated, ensureCompleteProfile, function(req, res){
		db.on([+req.param('id'), +req.user.id])
		.spread(db.fetchRoomAndUserAuth)
		.then(function(room){
			if (!checkAuthAtLeast(room.auth, 'admin')) {
				return res.render('error.jade', { error: "Admin level is required to manage the room" });
			}
			res.render('room.jade', { room: JSON.stringify(room), error: "null" });
		}).catch(db.NoRowError, function(err){
			res.render('room.jade', { room: "null", error: "null" });
		}).finally(db.off);
	});
	app.post('/room', ensureAuthenticated, ensureCompleteProfile, function(req, res){		
		var roomId = +req.param('id'), name = req.param('name').trim();
		if (!/^.{2,20}$/.test(name)) {
			return res.render('error.jade', { error: "invalid room name" });
		}
		var room = {id:roomId, name: name, private:req.param('private')||false, description:req.param('description')};
		db.on([room, req.user])
		.spread(db.storeRoom)
		.then(function(){
			res.redirect(roomUrl(room));			
		}).catch(function(err){
			res.render('room.jade', { room: JSON.stringify(room), error: JSON.stringify(err.toString()) });
		}).finally(db.end);
	});
	
	app.get('/auths', ensureAuthenticated, ensureCompleteProfile, function(req, res){
		db.on([+req.param('id'), +req.user.id])
		.spread(db.fetchRoomAndUserAuth)
		.then(function(room){
			room.path = roomPath(room);
			return [
				this.listRoomAuths(room.id),
				this.listOpenAccessRequests(room.id),
				this.listRecentUsers(room.id, 50),
				room
			];
		}).spread(function(auths, requests, recentUsers, room) {
			var authorizedUsers = {}, unauthorizedUsers = [];
			auths.forEach(function(a){
				authorizedUsers[a.player] = true;
			});
			recentUsers.forEach(function(u){
				if (!authorizedUsers[u.id]) unauthorizedUsers.push(u);
			});
			res.render('auths.jade', { room:room, auths:auths, requests:requests, unauthorizedUsers:unauthorizedUsers });
		}).catch(db.NoRowError, function(err){
			console.log(err);
			res.render('error.jade', { error: "room not found" });
		}).finally(db.off);
	});
	app.post('/auths', ensureAuthenticated, ensureCompleteProfile, function(req, res){
		var room; // todo find more elegant than storing as a variable in this scope
		db.on([+req.param('room'), +req.user.id])
		.spread(db.fetchRoomAndUserAuth)
		.then(function(r){
			room = r;
			if (!checkAuthAtLeast(room.auth, 'admin')) {
				return res.render('error.jade', { error: "Admin auth is required" });
			}
			var m, actions = [];
			for (var key in req.body){
				if (m = key.match(/^answer_request_(\d+)$/)) {
					var accepted = req.body[key]==='grant', modifiedUserId = +m[1];
					if (accepted) actions.push({cmd:'insert_auth', auth:'write', user:modifiedUserId});
					ws.emitAccessRequestAnswer(room.id, modifiedUserId, accepted);
					actions.push({cmd:'delete_ar', user:modifiedUserId});
				} else if (m = key.match(/^insert_auth_(\d+)$/)) {
					if (req.body[key]!='none') actions.push({cmd:'insert_auth', auth:req.body[key], user:+m[1]});
				} else if (m = key.match(/^change_auth_(\d+)$/)) {
					var new_auth = req.body[key], modifiedUserId = +m[1];
					if (new_auth==='none') actions.push({cmd:'delete_auth', user:modifiedUserId});
					else actions.push({cmd:'update_auth', user:modifiedUserId, auth:new_auth});
				}
			}
			return this.changeRights(actions, req.user.id, r);
		}).then(function(){
			res.redirect(roomUrl(room));
		}).catch(db.NoRowError, function(err){
			res.render('error.jade', { error: "room not found" });
		}).catch(function(err){
			res.render('error.jade', { error: err.toString() });
		}).finally(db.off);
	});

	app.get('/rooms', ensureAuthenticated, ensureCompleteProfile, function(req, res){
		db.on(+req.user.id)
		.then(function(uid){
			return [
				this.listFrontPageRooms(uid),
				this.fetchUserPingRooms(uid, 0)
			]
		}).spread(function(rooms, pings){
			rooms.forEach(function(r){ r.path = roomPath(r) });
			res.render(mobile(req) ? 'rooms.mob.jade' : 'rooms.jade', { rooms:rooms, pings:pings });
		}).finally(db.off);
	});

	app.get('/logout', function(req, res){
		if (req.user) console.log('User ' + req.user.id + ' log out');
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

	ws.listen(server, sessionStore, cookieParser, db);
}

(function main() { // main
	db.init(config.database, startServer);
})();
