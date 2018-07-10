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
		return prefs.get(this, req.user.id)
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
exports.appGetPublicProfile = function(req, res){
	res.setHeader("Cache-Control", "public, max-age=120"); // 2 minutes
	let	userId = +req.query.user,
		roomId = +req.query.room;
	if (!userId || !roomId) {
		return server.renderErr(res, 'room and user must be provided');
	}
	let bo = bench.start("publicProfile");
	db.do(async function(con){
		let user = await con.getUserById(userId);
		let room = await con.fetchRoomAndUserAuth(roomId, userId);
		let userinfo = await con.getUserInfo(userId);
		let auth = authToRole(room.auth, room.private);
		let externalProfileInfos = [];
		let pluginAdditions = [];
		for (let i=0; i<plugins.length; i++) {
			let plugin = plugins[i];
			let ppi = await con.getPlayerPluginInfo(plugin.name, userId);
			if (plugin.getPublicProfileAdditions) {
				let additions = await plugin.getPublicProfileAdditions(con, user, room, ppi);
				[].push.apply(pluginAdditions, additions);
			}
			let ep = plugin.externalProfile;
			if (!ppi || !ep) continue;
			if (ep.rendering.filter && !ep.rendering.filter(ppi.info, room)) continue;
			let html = ep.rendering.render(ppi.info, room);
			if (!html) continue;
			externalProfileInfos.push({
				name: plugin.name,
				html
			});
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
		bo.end();
	}, function(err){
		server.renderErr(res, err);
	});
}

// answer to queries for the user page
exports.appGetUser = function(req, res){
	let	userIdOrName = req.params[0];
	db.do(async function(con){
		let user;
		if (userIdOrName==+userIdOrName) {
			user = await con.getUserById(+userIdOrName);
		} else {
			user = await con.getUserByName(userIdOrName);
		}
		if (!user) throw new Error("User not found");
		let userinfo = await con.getUserInfo(user.id);
		let externalProfileInfos = [];
		let pluginAdditions = [];
		for (let i=0; i<plugins.length; i++) {
			let plugin = plugins[i];
			let ppi = await con.getPlayerPluginInfo(plugin.name, user.id);
			if (plugin.getUserPageAdditions) {
				let additions = await plugin.getUserPageAdditions(con, user, ppi);
				[].push.apply(pluginAdditions, additions);
			}
			let ep = plugin.externalProfile;
			if (!ppi || !ep) continue;
			if (ep.filter && !ep.filter(ppi, null)) continue;
			let html = plugin.externalProfile.rendering.render(ppi.info);
			if (!html) continue;
			externalProfileInfos.push({
				name: plugin.name,
				html
			});
		}
		res.render('user.pug', {
			vars: {
				user,
				userinfo,
				avatar: avatarsrc(user.avatarsrc, user.avatarkey)
			},
			pluginAdditions,
			externalProfileInfos
		});
	}, function(err){
		server.renderErr(res, err, '../');
	});
}
