// Manages user preferences, including external profile infos and the choice of theme.
//

var	VALUE_MAX_LENGTH = 20, // must be not greater than the limit set in the DB table
	Promise = require("bluebird"),
	path = require('path'),
	naming = require('./naming.js'),
	db,
	server = require('./server.js'),
	cache = require('bounded-cache')(5),
	defaultPrefs = { // also defines the valid keys
		notif: 'on_ping',	// when to raise a desktop notification
		sound: 'standard', 	// sound on notification
		datdpl: 'hover',	// date display 
		nifvis: 'no',		// notifies even if the tab is visible
		theme: 'default'	//
	},
	langs,
	themes,
	plugins;
	
exports.configure = function(miaou){
	db = miaou.db;
	langs = require('./langs.js').configure(miaou);
	themes = miaou.config.themes;
	plugins = (miaou.config.plugins||[]).map(function(n){ return require(path.resolve(__dirname, '..', n)) });
	return this;
}

exports.theme = function(prefs, requestedTheme){
	if (requestedTheme && ~themes.indexOf(requestedTheme)) return requestedTheme;
	if (prefs && prefs.theme && prefs.theme!=='default') return prefs.theme;
	return themes[0];
}

// returns either the prefs as a map object or a promise fullfilled with the prefs.
// This function must be called with context being a db connection
var getUserPrefs = exports.get = function(userId){
	return cache.get(userId) || this.getPrefs(userId).reduce(function(prefs, row){
		prefs[row.name] = row.value;
		return prefs;
	}, {}).then(function(prefs){
		for (var key in defaultPrefs) {
			if (!prefs[key]) prefs[key] = defaultPrefs[key];
		}
		cache.set(userId, prefs);
		return prefs;
	});
}

// user prefs page GET & POST
exports.appAllPrefs = function(req, res, db){
	var externalProfileInfos = plugins.filter(function(p){ return p.externalProfile}).map(function(p){
		return { name:p.name, ep:p.externalProfile, fields:p.externalProfile.creation.fields }
	});
	var error = '',
		userPrefs;
	db.on().then(function(){
		return getUserPrefs.call(this, req.user.id);
	}).then(function(obj){
		userPrefs = obj;
		return externalProfileInfos;
	}).map(function(epi){
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
			var name = req.param('name').trim();
			if (name === req.user.name || !naming.isValidUsername(name)) return;
			if (naming.isUsernameForbidden(name)) {
				error = "Sorry, that username is reserved.";
				return;
			}
			req.user.name = name;
			return this.updateUser(req.user);
		}
	}).then(function(){
		if (req.method==='POST') {
			return this.updateUserInfo(req.user.id, {
				description: req.param('description')||null,
				location: req.param('location')||null,
				url: req.param('url')||null,
				lang: req.param('lang')||null
			});
		}
	}).then(function(){
		if (req.method==='POST') {
			var dbops = [];
			for (var key in defaultPrefs) {
				var val = req.param(key);
				if (!val || val===userPrefs[key]) continue;
				if (val.length>VALUE_MAX_LENGTH) {
					console.log("pref value too long :", val);
					continue;				
				}
				dbops.push(this.upsertPref(req.user.id, key, val));	
				userPrefs[key] = val; // update the cache
			}
			return Promise.all(dbops);
		}
	}).catch(function(err){
		console.log('Err...', err);
		if (err.code=='23505') { // PostgreSQL / unique_violation
			error = "Sorry, this username isn't available."
		} else {
			error = err;
		}
	}).then(function(){
		return this.getUserInfo(req.user.id);
	}).then(function(userinfo){
		externalProfileInfos.forEach(function(epi){
			if (epi.ep.creation.describe) epi.creationDescription = epi.ep.creation.describe(req.user);
		});
		var hasValidName = naming.isValidUsername(req.user.name);
		res.render('prefs.jade', {
			user: req.user,
			error: error,
			suggestedName:  hasValidName ? req.user.name : naming.suggestUsername(req.user.oauthdisplayname || ''),
			themes: themes,
			externalProfileInfos: externalProfileInfos,
			vars:{
				userPrefs: userPrefs,
				valid : hasValidName,
				langs: langs.legal,
				userinfo: userinfo,
			}
		});
	}).catch(function(err){
		server.renderErr(res, err);
	}).finally(db.off)
}

