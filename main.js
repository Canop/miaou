var fs = require("fs"),
	http = require('http'),
	connect = require('connect'),
	express = require('express'),
	passport = require('passport'),
	jade = require('jade'),
	util = require('util'),
	config = require('./config.json'),
	db = require('./pgdb.js'),
	loginutil = require('./login.js'),
	request = require('request')/*.defaults({json: true})*/,
	Busboy = require('busboy'),
	path = require('path'),
	fs = require('fs'),
	ws = require('./ws.js'),
	plugins = (config.plugins||[]).map(require),
	cookieParser = express.cookieParser(config.secret),
	RedisStore = require('connect-redis')(express),
	oauth2Strategies = {},
	sessionStore = new RedisStore({}),
	mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|Mini/i,
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

function renderErr(res, err, base){
	console.log(err);
	res.render('error.jade', { base:base||'', error: err.toString() });
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
			res.render(mobile(req) ? 'chat.mob.jade' : 'chat.jade', { user:JSON.stringify(req.user), room:JSON.stringify(room) });
		}).catch(db.NoRowError, function(err){
			// not an error as it happens when there's no room id in url
			res.redirect(url('/rooms'));
		}).finally(db.off);
	});
	
	app.get('/login', function(req, res){
		res.render('login.jade', { user:req.user, oauth2Strategies:oauth2Strategies });
	});
	
	app.all('/profile', ensureAuthenticated, function(req, res){
		var externalProfileInfos = plugins.filter(function(p){ return p.externalProfile}).map(function(p){
			return { name:p.name, ep:p.externalProfile, fields:p.externalProfile.creation.fields }
		});
		var error = '';
		db.on(externalProfileInfos)
		.map(function(epi){
			return this.getPlayerPluginInfo(epi.name, req.user.id);
		}).then(function(ppis){ // todo use map(ppi,i) to avoid iteration
			ppis.forEach(function(ppi,i){
				if (ppi) externalProfileInfos[i].ppi = ppi.info;
			});
			return externalProfileInfos;
		}).map(function(epi){
			if (epi.ppi) epi.html = epi.ep.render(epi.ppi);
			if (req.method==='POST') {
				if (epi.html) {
					if (req.param('remove_'+epi.name)) {
						epi.ppi = null;
						return this.deletePlayerPluginInfo(epi.name, req.user.id);
					}
				} else {
					var vals = {}, allFilled = true;
					epi.fields.forEach(function(f){
						if (!(vals[f.name] = req.param(f.name))) allFilled = false;
					});
					if (allFilled) return epi.ep.creation.create(req.user, epi.ppi||{}, vals);
				}
			}
		}).map(function(ppi, i){
			var epi = externalProfileInfos[i];
			if (typeof ppi === 'object') { // in case of creation success
				epi.ppi = ppi;
				this.storePlayerPluginInfo(epi.name, req.user.id, ppi);
				epi.html = epi.ep.render(ppi);
			} else if (ppi===1) { // deletion
				epi.html = null;
			}
		}).then(function(){
			if (req.method==='POST') {
				var name = req.param('name');
				if (name!=req.user.name && loginutil.isValidUsername(name)) {
					req.user.name = name;
					return this.updateUser(req.user);
				}
			}
		}).catch(function(err){
			console.log('Err...', err);
			error = err;
		}).then(function(){
			externalProfileInfos.forEach(function(epi){
				if (epi.ep.creation.describe) epi.creationDescription = epi.ep.creation.describe(req.user);
			});
			var hasValidName = loginutil.isValidUsername(req.user.name);
			res.render('profile.jade', {
				user: req.user,
				externalProfileInfos: externalProfileInfos,
				valid : hasValidName,
				suggestedName:  hasValidName ? req.user.name : loginutil.suggestUsername(req.user.oauthdisplayname || ''),
				error: error
			});
		}).catch(function(err){
			renderErr(res, err);
		}).finally(db.off)
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
				return renderErr(res, "Admin level is required to manage the room");
			}
			res.render('room.jade', { room: JSON.stringify(room), error: "null" });
		}).catch(db.NoRowError, function(err){
			res.render('room.jade', { room: "null", error: "null" });
		}).catch(function(err){
			renderErr(res, err);
		}).finally(db.off);
	});
	app.post('/room', ensureAuthenticated, ensureCompleteProfile, function(req, res){		
		var roomId = +req.param('id'), name = req.param('name').trim(), room;
		if (!/^.{2,50}$/.test(name)) {
			return renderErr(res, "invalid room name");
		}
		db.on([roomId, req.user.id, 'admin'])
		.spread(db.checkAuthLevel)
		.then(function(auth){
			room = {id:roomId, name: name, private:req.param('private')||false, listed:req.param('listed')||false, dialog:false, description:req.param('description')};
			return [room, req.user, auth];
		}).spread(db.storeRoom)
		.then(function(){
			res.redirect(roomUrl(room));	
		}).catch(function(err){
			res.render('room.jade', { room: JSON.stringify(room), error: JSON.stringify(err.toString()) });
		}).finally(db.off);
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
			renderErr(res, "room not found");
		}).catch(function(err){
			renderErr(res, err);
		}).finally(db.off);
	});
	app.post('/auths', ensureAuthenticated, ensureCompleteProfile, function(req, res){
		var room; // todo find more elegant than storing as a variable in this scope
		db.on([+req.param('room'), +req.user.id])
		.spread(db.fetchRoomAndUserAuth)
		.then(function(r){
			room = r;
			if (!checkAuthAtLeast(room.auth, 'admin')) {
				return renderErr(res, "Admin auth is required");
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
			renderErr(res, "room not found");
		}).catch(function(err){
			renderErr(res, err);
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
			res.render(mobile(req) ? 'rooms.mob.jade' : 'rooms.jade', { rooms:rooms, pings:pings, user:req.user });
		}).catch(function(err){
			renderErr(res, err);
		}).finally(db.off);
	});

	app.get('/logout', function(req, res){
		if (req.user) console.log('User ' + req.user.id + ' log out');
		req.logout();
		res.redirect(url());
	});

	app.get('/help', function(req, res){
		res.setHeader("Cache-Control", "public, max-age=7200"); // 2 hours
		res.render('help.jade');
	});
	
	app.get('/publicProfile', function(req,res){
		res.setHeader("Cache-Control", "public, max-age=120"); // 2 minutes
		var userId = +req.param('user'), roomId = +req.param('room');
		var externalProfileInfos = plugins.filter(function(p){ return p.externalProfile}).map(function(p){
			return { name:p.name, ep:p.externalProfile }
		});			
		if (!userId || !roomId) return renderErr(res, 'room and user must be provided');
		var user, auth;
		db.on(userId)
		.then(db.getUserById)
		.then(function(u){
			user = u;
			return this.fetchRoomAndUserAuth(roomId, userId);
		}).then(function(r){
			switch(r.auth) {
			case 'write': auth='writer'; break;
			case 'admin': auth='admin'; break;
			case 'own'  : auth='owner'; break;
			case null: case undefined: auth= r.private ? 'no access' : 'none';
			}
			return externalProfileInfos;
		}).map(function(epi){
			return this.getPlayerPluginInfo(epi.name, userId);
		}).map(function(ppi, i){
			if (ppi) externalProfileInfos[i].html = externalProfileInfos[i].ep.render(ppi.info);
		}).then(function(){
			externalProfileInfos = externalProfileInfos.filter(function(epi){ return epi.html });
			res.render('publicProfile.jade', {user:user, auth:auth, externalProfileInfos:externalProfileInfos});
		}).catch(function(err){
			renderErr(res, err)
		}).finally(db.off);
	});
	
	app.get(/^\/user\/(\d+)$/, function(req,res){
		db.on(+req.params[0])
		.then(function(uid){
			return [
				this.getUserById(uid),
				this.listRecentUserRooms(uid)
			]
		}).spread(function(user, rooms){
			rooms.forEach(function(r){ r.path = '../'+roomPath(r) });
			res.render('user.jade', {user:user, rooms:rooms});
		}).catch(db.NoRowError, function(err){
			renderErr(res, "User not found", '../');
		}).catch(function(err){
			renderErr(res, err, '../');
		}).finally(db.off);
	});
	
	app.post('/upload', function (req, res) { // TODO delegate implementation to a specific js module
		if (!config.imgur || !config.imgur.clientID) {
			console.log('To activate the imgur service, register your application at imgur.com and set the imgur.clientID property in the config.json file.');
			return res.send({error:"upload service not available"}); // todo : don't show upload button in this case
		}
		var busboy = new Busboy({ headers: req.headers }), files=[];
		busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
			var chunks = [];
			file.on('data', function(chunk) {
				chunks.push(chunk);				
				// todo : abort if sum of chunk.lengths is too big (and tell the client he's fat)
			});
			file.on('end', function() {
				files.push({name:fieldname, bytes:Buffer.concat(chunks)});
			});
		});
		busboy.on('finish', function() {
			console.log('Done parsing form');
			if (files.length==0) {
				return res.send({error:'found nothing in form'});
			}
			// for now, we handle only the first file, we'll see later if we want to upload galleries
			console.log('Trying to send image of '+ files[0].bytes.length +' bytes to imgur :', files[0].name);
			var options = {
				url: 'https://api.imgur.com/3/upload',
				headers: { Authorization: 'Client-ID ' + config.imgur.clientID }
			};
			var r = request.post(options, function(err, req, body){
				console.log('imgur answered : ', err, body);
				if (err) return res.send({error:'Error while uploading to imgur'});
				var data = JSON.parse(body).data;
				if (!data || !data.id) res.send({error:"Miaou didn't understand imgur's answer"});
				res.send({image:data});
			})
			var form = r.form();
			form.append('type', 'file');
			form.append('image', files[0].bytes);
		});
		req.pipe(busboy);		
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
