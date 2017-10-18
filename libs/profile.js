const	auths = require('./auths.js'),
	path = require('path'),
	naming = require('./naming.js'),
	prefs = require('./prefs.js'),
	bench = require('./bench.js'),
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
				return this.updateUser(req.user).then(function(){
					return this.insertNameChange(req.user);
				});
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
		res.render('username.pug', {
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

function authToRole(auth, rprivate){
	if (auth==='write') return "writer";
	if (auth==='admin') return "admin";
	if (auth==='own') return "owner";
	return rprivate ? "no access" : "none";
}

// handles GET on '/publicProfile'
// used to fill the popup seen when hovering a user name
exports.appGetPublicProfile = async function(req, res){
	res.setHeader("Cache-Control", "public, max-age=120"); // 2 minutes
	let	userId = +req.query.user,
		roomId = +req.query.room;
	if (!userId || !roomId) {
		return server.renderErr(res, 'room and user must be provided');
	}
	let bo = bench.start("publicProfile");
	db.on().then(async function(){
		let con = this;
		let user = await con.getUserById(userId);
		let room = await con.fetchRoomAndUserAuth(roomId, userId);
		let userinfo = await con.getUserInfo(userId);
		let auth = authToRole(room.auth, room.private);
		let externalProfileInfos = [];
		let pluginAdditions = [];
		for (let i=0; i<plugins.length; i++) {
			let plugin = plugins[i];
			let ppi = await con.getPlayerPluginInfo(plugin.name, userId);
			if (ppi && plugin.externalProfile) {
				let html = plugin.externalProfile.render(ppi.info);
				if (html) {
					externalProfileInfos.push({
						name: plugin.name,
						html
					});
				}
			}
			if (plugin.getPublicProfileAdditions) {
				let additions = await plugin.getPublicProfileAdditions(con, user, room, ppi);
				console.log('additions:', additions);
				[].push.apply(pluginAdditions, additions);
			}
		}
		res.render('publicProfile.pug', {
			user,
			userinfo,
			avatar: avatarsrc(user.avatarsrc, user.avatarkey),
			isServerAdmin: auths.isServerAdmin(user),
			auth,
			pluginAdditions,
			externalProfileInfos
		});
	}).catch(function(err){
		server.renderErr(res, err);
	}).finally(db.off);
	bo.end();
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
		res.render('user.pug', { vars:vars, externalProfileInfos:externalProfileInfos });
	}).catch(db.NoRowError, function(){
		server.renderErr(res, "User not found", '../');
	}).catch(function(err){
		server.renderErr(res, err, '../');
	}).finally(db.off);
}
