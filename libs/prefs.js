// Manages user preferences, including external profile infos and the choice of theme.
//

const	VALUE_MAX_LENGTH = 20, // must be not greater than the limit set in the DB table
	path = require('path'),
	naming = require('./naming.js'),
	server = require('./server.js'),
	crypto = require('crypto'),
	cache = require('bounded-cache')(500),
	definitions = [];

var	db,
	langs,
	themes,
	mobileTheme,
	plugins;

const definePref = exports.definePref = function(key, defaultValue, name, values){
	if (!values) values = ["yes", "no"];
	values = values.map(v=>{
		if (typeof v !== "object") {
			v = {value:v};
		}
		if (!v.label) v.label = v.value;
		return v;
	});
	definitions.push({key, defaultValue, name, values});
}

exports.getPrefDefinitions = function(){
	return definitions;
}

exports.configure = function(miaou){
	db = miaou.db;
	langs = miaou.lib("langs");
	themes = miaou.config.themes;
	mobileTheme = miaou.conf("mobileTheme") || themes[0];
	plugins = (miaou.config.plugins||[]).map(n => require(path.resolve(__dirname, '..', n)));
	definePref(
		"notif", 'on_ping', "Desktop Notification", [
			{ value:"never", label:"Never"},
			{ value:"on_ping", label:"When you're pinged or replied to (highly recommended)" },
			{ value:"on_message", label:"Whenever a message is posted in an open room" }
		]
	);
	definePref(
		"connot", 'yes', "Show Message Content in Desktop Notification"
	);
	definePref(
		"volume", .7, "Notification Sound", [
			{value: 0, label: "none"},
			{value: 0.1, label: "very quiet"},
			{value: 0.4, label: "quiet"},
			{value: 0.7, label: "standard"},
			{value: 1, label: "strong"}
		]
	);
	definePref(
		"datdpl", 'hover', "Message Date Display", [
			{value:"hover", label:"On hover"},
			{value:"on_breaks", label:"On breaks"},
			{value:"always", label:"Always"}
		]
	);
	definePref(
		"nifvis", 'no',	"When Tab Is Visible", [
			{ value:"no", label:"No notification"},
			{ value:"yes", label:"Notify too"}
		]
	);
	definePref(
		"theme", 'default', "theme",
		["default", ...themes]
	);
	definePref(
		"otowat", 'on_post', "Auto-watch rooms", [
			{value:"on_visit", label:"When visiting the room"},
			{value:"on_post", label:"When posting in the room"},
			{value:"never", label:"Never"}
		]
	);
	definePref(
		"beta", 'no', "participage in beta tests"
	);
	definePref(
		"mclean", -1,	"Auto-clean Messages",
		[{value:-1, label:"disabled"}, 50, 100, 200, 300, 500, 1000]
	);
	return this;
}

function getNormalizedValue(definition, val){
	if (!val) return;
	if (val.length>VALUE_MAX_LENGTH) {
		throw new Error("Preference value too long: " + val);
	}
	for (let v of definition.values) {
		if (val==v.value) return v.value;
	}
	throw new Error("Not an authorized value for " + definition.key + " : " + val);
}

exports.theme = function(prefs, requestedTheme, isMobile){
	if (isMobile) return mobileTheme;
	if (requestedTheme && ~themes.indexOf(requestedTheme)) return requestedTheme;
	if (prefs && prefs.theme && prefs.theme!=='default') return prefs.theme;
	return themes[0];
}

// asynchronously return the user's prefs as {key:value}
const getUserPrefs = exports.get = async function(con, userId){
	let prefs = cache.get(userId);
	if (prefs) return prefs;
	let rows = await con.getPrefs(userId);
	prefs = rows.reduce(function(prefs, row){
		prefs[row.name] = row.value;
		return prefs;
	}, {});
	for (var def of definitions) {
		if (prefs[def.key]==undefined) prefs[def.key] = def.defaultValue;
	}
	cache.set(userId, prefs);
	return prefs;
}

// user prefs page GET & POST
exports.appAllPrefs = async function(req, res){
	let externalProfileInfos = plugins
	.filter(p => p.externalProfile)
	.map(
		p => ({ name:p.name, ep:p.externalProfile, fields:p.externalProfile.creation.fields })
	);
	db.do(async function(con){
		let userPrefs = await getUserPrefs(con, req.user.id);
		let userinfo;
		let pluginAvatars;
		let error;
		try {
			for (let epi of externalProfileInfos) {
				let ppi = await con.getPlayerPluginInfo(epi.name, req.user.id);
				if (ppi) {
					epi.ppi = ppi.info;
					epi.html = epi.ep.render(epi.ppi);
				}
				if (req.method!=='POST') continue;
				// the rest of the loop is related to external profile addition or removal
				if (epi.html) {
					// there's already an external profile
					if (req.body['remove_'+epi.name]) {
						// user wants to delete the profile (which deletes the whole PPI)
						epi.ppi = null;
						epi.html = null;
						let res = await con.deletePlayerPluginInfo(epi.name, req.user.id);
						console.log('deletePPI res:', res);
					}
					continue;
				}
				var	vals = {},
					allFilled = true;
				epi.fields.forEach(function(f){
					if (!(vals[f.name] = req.body[f.name])) allFilled = false;
				});
				if (!allFilled) continue;
				epi.ppi = await epi.ep.creation.create(req.user, epi.ppi||{}, vals);
				await con.storePlayerPluginInfo(epi.name, req.user.id, epi.ppi);
				epi.html = epi.ep.render(ppi);
			}
			if (req.method==='POST') {
				var	name = req.body.name.trim(),
					nameChanges = req.user.name != name,
					avatarsrc = req.body['avatar-src'],
					avatarkey = req.body['avatar-key'];
				if (!naming.isValidUsername(name)) return;
				if (nameChanges && naming.isUsernameForbidden(name)) {
					error = "Sorry, that username is reserved.";
					return;
				}
				if (avatarsrc==="none") {
					avatarsrc = avatarkey = null;
				}
				if (name!==req.user.name || avatarsrc!==req.user.avatarsrc || avatarkey!==req.user.avatarkey) {
					req.user.name = name;
					req.user.avatarsrc = avatarsrc;
					req.user.avatarkey = avatarkey;
					try {
						await con.updateUser(req.user);
					} catch (err) {
						if (err.code=='23505') { // PostgreSQL / unique_violation
							throw new Error("Sorry, this username isn't available.");
						}
					}
					await con.insertNameChange(req.user);
				}
				await con.updateUserInfo(req.user.id, {
					description: req.body.description||null,
					location: req.body.location||null,
					url: req.body.url||null,
					lang: req.body.lang||null
				});
				for (let def of definitions) {
					var val = getNormalizedValue(def, req.body[def.key]);
					if (val===undefined || val===userPrefs[def.key]) continue;
					await con.upsertPref(req.user.id, def.key, val);
					userPrefs[def.key] = val; // update the cache
				}
			}
			userinfo = await con.getUserInfo(req.user.id);
			pluginAvatars = {};
			externalProfileInfos.forEach(function(epi){
				if (epi.ep.creation.describe) epi.creationDescription = epi.ep.creation.describe(req.user);
				if (epi.ppi && epi.ep.avatarUrl) {
					var url = epi.ep.avatarUrl(epi.ppi);
					if (url) pluginAvatars[epi.name] = url;
				}
			});
			var hasValidName = naming.isValidUsername(req.user.name);
		} catch (e) {
			console.error(e);
			error = e.toString();
		}
		var data = {
			user: req.user,
			error,
			suggestedName: hasValidName ? req.user.name : naming.suggestUsername(req.user.oauthdisplayname || ''),
			themes,
			externalProfileInfos,
			vars: {
				userPrefs,
				prefDefinitions: definitions,
				valid : hasValidName,
				langs: langs.legal,
				userinfo,
				email: req.user.email,
				avatarsrc: req.user.avatarsrc,
				avatarkey: req.user.avatarkey,
				pluginAvatars
			}
		};
		if (!server.mobile(req)) {
			data.theme = exports.theme(userPrefs, req.query.theme);
		}
		res.render('prefs.pug', data);
	});
}

// used to allow conversion of email to MD5 for gravatar
exports.appGetJsonStringToMD5 = function(req, res){
	console.log("md5 hashing " + req.query.input);
	res.json({
		md5: crypto.createHash('md5').update(req.query.input).digest('hex')
	});
}

function handleSetCommand(ct){
	var match = ct.args.match(/^local\s+(\S+)(?:\s+(\S+))?\s*$/);
	if (!match) {
		// non local, not yet handled
		throw "Non local settings aren't handled yet";
	}
	ct.nostore = true;
	if (!match[2]) ct.silent = true;
}

// registers the !!set command, which is used for local browser preferences
// (will probably allow server managed preferences in the future)
exports.registerCommands = function(registerCommand){
	registerCommand({
		name: 'set',
		fun: handleSetCommand,
		help: "sets a preference: `!!set local fun max`",
		detailedHelp: "Only local browser prefs are managed this way today",
	});
}

