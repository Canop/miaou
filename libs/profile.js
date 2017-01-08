const	auths = require('./auths.js'),
	path = require('path'),
	naming = require('./naming.js'),
	prefs = require('./prefs.js'),
	server = require('./server.js');

var	db,
	plugins;

exports.configure = function(miaou){
	db = miaou.db;
	let conf = miaou.config;
	plugins = (conf.plugins||[]).map(n => require(path.resolve(__dirname, '..', n)));
	return this;
}

// Problem: the exact same code is duplicated here and in src/main-js/miaou.usr.js
var avatarsrc = exports.avatarsrc = function(source, key){
	if (!key) return;
	if (/^https?:\/\//.test(key)) return key; // this is hacky...
	if (source==="gravatar") { // because avatars.io redirects https to http, I try to avoid it
		return "https://www.gravatar.com/avatar/"+key+"?s=200";
	}
	return 'https://avatars.io/'+source+'/'+key+'?size=large';
}

// Checks that the profile is complete enough to be used for the chat
//  (a valid name is needed). If not, the user is redirected to the
//  page where he can set his name.
exports.ensureComplete = function(req, res, next){
	if (naming.isValidUsername(req.user.name)) return next();
	res.redirect(server.url('/username'));
}

// handles get and post of the simple profile creation/edition ('/username' requests)
exports.appAllUsername = function(req, res){
	var error = '';
	db.on()
	.then(function(){
		if (req.method==='POST') {
			var name = req.body.name;
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
		return prefs.get.call(this, req.user.id)
	}).then(function(userPrefs){
		var hasValidName = naming.isValidUsername(req.user.name),
			theme = prefs.theme(userPrefs, req.query.theme);
		res.render('username.jade', {
			vars: {valid : hasValidName},
			suggestedName:  hasValidName ? req.user.name : naming.suggestUsername(req.user.oauthdisplayname || ''),
			error,
			theme
		});
	}).catch(function(err){
		console.log('err in appAllUsername');
		server.renderErr(res, err);
	}).finally(db.off)
}

// handles GET on '/publicProfile'
// used to fill the popup seen when hovering a user name
exports.appGetPublicProfile = function(req, res){
	res.setHeader("Cache-Control", "public, max-age=120"); // 2 minutes
	var	userId = +req.query.user,
		roomId = +req.query.room;
	var externalProfileInfos = plugins.filter(p => p.externalProfile).map(function(p){
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
		switch (r.auth) {
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
		externalProfileInfos = externalProfileInfos.filter(epi => epi.html);
		res.render('publicProfile.jade', {
			user:user, userinfo:info, avatar:avatarsrc(user.avatarsrc, user.avatarkey),
			isServerAdmin:auths.isServerAdmin(user),
			auth:auth, externalProfileInfos:externalProfileInfos
		});
	}).catch(function(err){
		server.renderErr(res, err)
	}).finally(db.off);
}

exports.appGetUser = function(req, res){
	var	userIdOrName = req.params[0],
		user;
	var externalProfileInfos = plugins.filter(p => p.externalProfile).map(function(p){
		return { name:p.name, ep:p.externalProfile }
	});
	db.on().then(function(){
		return userIdOrName==+userIdOrName ? this.getUserById(userIdOrName) : this.getUserByName(userIdOrName)
	}).then(function(u){
		user = u;
		if (!user) throw new db.NoRowError();
		return externalProfileInfos;
	}).map(function(epi){
		return this.getPlayerPluginInfo(epi.name, user.id);
	}).map(function(ppi, i){
		if (ppi) externalProfileInfos[i].html = externalProfileInfos[i].ep.render(ppi.info);
	}).then(function(){
		return this.getUserInfo(user.id);
	}).then(function(info){
		let vars = {
			user:user, userinfo:info, avatar:avatarsrc(user.avatarsrc, user.avatarkey)
		};
		res.render('user.jade', { vars:vars, externalProfileInfos:externalProfileInfos });
	}).catch(db.NoRowError, function(){
		server.renderErr(res, "User not found", '../');
	}).catch(function(err){
		server.renderErr(res, err, '../');
	}).finally(db.off);
}
