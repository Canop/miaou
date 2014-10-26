var path = require('path'),
	naming = require('./naming.js'),
	server = require('./server.js'),
	langs,
	plugins;

exports.configure = function(miaou){
	var conf = miaou.config;
	langs = require('./langs.js').configure(miaou);
	plugins = (conf.plugins||[]).map(function(n){ return require(path.resolve(__dirname, '..', n)) });
	return this;
}

// Checks that the profile is complete enough to be used for the chat
//  (a valid name is needed). If not, the user is redirected to the 
//  page where he can set his name.
exports.ensureComplete = function(req, res, next){
	if (naming.isValidUsername(req.user.name)) return next();
	res.redirect(server.url('/username'));
}

// handles get and post of the simple profile creation/edition ('/username' requests)
exports.appAllUsername = function(req, res, db){
	var error = '';
	db.on()
	.then(function(){
		if (req.method==='POST') {
			var name = req.param('name');
			if (naming.isUsernameForbidden(name)) {
				error = "Sorry, that username is reserved.";
				return;
			}
			if (name!=req.user.name && naming.isValidUsername(name)) {
				req.user.name = name;
				return this.updateUser(req.user);
			}
		}
	}).catch(function(err){
		console.log('Err...', err);
		error = err;
	}).then(function(){
		var hasValidName = naming.isValidUsername(req.user.name);
		res.render('username.jade', {
			user: req.user,
			valid : hasValidName,
			suggestedName:  hasValidName ? req.user.name : naming.suggestUsername(req.user.oauthdisplayname || ''),
			error: error
		});
	}).catch(function(err){
		console.log('err in appAllUsername');
		server.renderErr(res, err);
	}).finally(db.off)
}


// handles GET on '/publicProfile'
exports.appGetPublicProfile = function(req, res, db){
	res.setHeader("Cache-Control", "public, max-age=120"); // 2 minutes
	var userId = +req.param('user'), roomId = +req.param('room');
	var externalProfileInfos = plugins.filter(function(p){ return p.externalProfile}).map(function(p){
		return { name:p.name, ep:p.externalProfile }
	});
	if (!userId || !roomId) return server.renderErr(res, 'room and user must be provided');
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
		return this.getUserInfo(userId);
	}).then(function(info){
		externalProfileInfos = externalProfileInfos.filter(function(epi){ return epi.html });
		res.render('publicProfile.jade', {user:user, userinfo:info, auth:auth, externalProfileInfos:externalProfileInfos});
	}).catch(function(err){
		server.renderErr(res, err)
	}).finally(db.off);
}

exports.appGetUser = function(req, res, db){
	db.on(+req.params[0])
	.then(function(uid){
		return [
			this.getUserById(uid),
			this.getUserInfo(uid),
			this.listRecentUserRooms(uid)
		]
	}).spread(function(user, info, rooms){
		rooms.forEach(function(r){ r.path = '../'+server.roomPath(r) });
		res.render('user.jade', {user:user, userinfo:info, rooms:rooms});
	}).catch(db.NoRowError, function(){
		server.renderErr(res, "User not found", '../');
	}).catch(function(err){
		server.renderErr(res, err, '../');
	}).finally(db.off);
}
