// Manages user preferences, including external profile infos and the choice of theme.
// Handles the !!pref command

const	VALUE_MAX_LENGTH = 20, // must be not greater than the limit set in the DB table
	dedent = require("./template-tags.js").dedent,
	path = require('path'),
	naming = require('./naming.js'),
	ws = require('./ws.js'),
	fmt = require('./fmt.js'),
	crypto = require('crypto'),
	webPush = require('./web-push.js'),
	cache = require('bounded-cache')(500),
	serverPrefs = Object.create(null), // defaults, as {key:value}
	definitions = []; // exportable definitions (sent to the browser)

var	db,
	langs,
	themes,
	mobileTheme,
	plugins;

// define a new preference, which users will see and be able to set.
// Plugins are required to prefix it as "pluginname."
const definePref = exports.definePref = function(
	key, defaultValue, name, values,
	{canBeLocal=true, description=null, onchange=null} = {}
){
	if (!values) values = ["yes", "no"];
	values = values.map(v=>{
		if (typeof v !== "object") {
			v = {value:v};
		}
		if (!v.label) v.label = v.value;
		return v;
	});
	definitions.push({
		key,
		defaultValue,
		name,
		values,
		canBeLocal,
		description,
		onchange
	});
	definitions.sort((a, b) => a.key.localeCompare(b.key));
	serverPrefs[key] = defaultValue;
}

function getDefinition(key){
	for (let i=definitions.length; i--;) {
		if (definitions[i].key==key) return definitions[i];
	}
}

exports.getDefinitions = function(){
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
		"mclean", -1,	"Auto-clean Messages",
		[{value:-1, label:"disabled"}, 50, 100, 200, 300, 500, 1000]
	);
	definePref(
		"fun", "normal", "Distraction Level",
		["none", "low", "normal", "high", "max"]
	);
	definePref(
		"web-push", "disabled", "Web-Push notifications",
		["disabled", "on_alert", "on_ping"],
		{
			description: dedent`
				If enabled, web push notifications can be sent to you even when you're offline.
				Works best for mobile device. Only one device can be registered at a given time.
				If you choose "on_alert", then you'll only be notified when offline when somebody
				uses the !!alert command`,
			onchange: function(con, user, key, value){
				webPush.unregisterSubscription(con, user);
			}
		}
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

function isValid(key, val){
	let def = getDefinition(key);
	if (!def) return false;
	for (let i=def.values.length; i--;) {
		if (def.values[i].value==val) return true;
	}
	return false;
}

exports.defaultTheme = function(isMobile){
	return isMobile ? mobileTheme : themes[0];
}

exports.theme = async function(con, userId, requestedTheme, isMobile){
	if (isMobile) return mobileTheme;
	if (requestedTheme && ~themes.indexOf(requestedTheme)) return requestedTheme;
	let prefs = await exports.getUserGlobalPrefs(con, userId);
	if (prefs && prefs.theme && prefs.theme!=='default') return prefs.theme;
	return themes[0];
}

// asynchronously return the user's global prefs as {key:value}
// this doesn't include
// 	- local prefs
// 	- sever prefs (aka defaults)
exports.getUserGlobalPrefs =  async function(con, userId){
	let guprefs = cache.get(userId);
	if (guprefs) return guprefs;
	let rows = await con.getPrefs(userId);
	guprefs = rows.reduce(function(guprefs, row){
		if (isValid(row.name, row.value)) {
			guprefs[row.name] = row.value;
		}
		return guprefs;
	}, {});
	cache.set(userId, guprefs);
	return guprefs;
}

// return the merged prefs of the user as {key: value}
// Both arguments are optionnal (if none is provided it returns the defaults)
exports.merge = function(userGlobalPrefs, userLocalPrefs){
	return Object.assign({}, serverPrefs, userGlobalPrefs, userLocalPrefs);
}

// user prefs page GET & POST
exports.appAllPrefs = async function(req, res){
	let externalProfileInfos = plugins
	.filter(p => p.externalProfile)
	.map(p => ({
		name: p.name,
		ep: p.externalProfile
	}));
	db.do(async function(con){
		let userPrefs = await exports.getUserGlobalPrefs(con, req.user.id);
		let userinfo;
		let pluginAvatars;
		let error;
		try {
			for (let epi of externalProfileInfos) {
				let ppi = await con.getPlayerPluginInfo(epi.name, req.user.id);
				if (ppi) {
					epi.ppi = ppi.info;
					epi.html = epi.ep.rendering.render(epi.ppi);
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
				epi.ep.creation.fields.forEach(function(f){
					if (!(vals[f.name] = req.body[f.name])) allFilled = false;
				});
				if (!allFilled) continue;
				epi.ppi = await epi.ep.creation.create(req.user, epi.ppi||{}, vals);
				await con.storePlayerPluginInfo(epi.name, req.user.id, epi.ppi);
				epi.html = epi.ep.rendering.render(epi.ppi);
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
				me: req.user,
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
		data.vars.theme = await exports.theme(con, req.user.id, req.query.theme);
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

function describe(ct, key){
	let def = getDefinition(key);
	if (!def) throw new Error("Unknown preference: " + key);
	let txt = `## ${key} preference:\n`;
	txt += fmt.tbl({
		cols: ["key", "name", "default value"],
		aligns: "cll",
		rows: [[def.key, def.name, def.defaultValue]]
	});
	if (def.description) {
		txt += "\n" + def.description;
	}
	txt += "\nPossible values:\n";
	txt += fmt.tbl({
		cols: ["value", "description"],
		aligns: "ll",
		rows: def.values.map(v => [v.value, v.label])
	});
	ct.reply(txt);
}

async function handlePrefCommand(ct){
	let match = ct.args.match(/^describe\s*(\S+)$/);
	if (match) {
		return describe(ct, match[1]);
	}
	// If the command is for pref modification we wheck the key and value
	// are ok and if it's a global pref we do the change (if it's local
	// the browser will do it on sio event)
	match = ct.args.match(
		/^(set|unset)\s*(local|global)?\s*(\S+)?\s*(.*)$/
	);
	if (match) {
		let [, verb, scope, key, value] = match;
		let def = getDefinition(key);
		if (!def) throw new Error("Unknown preference: " + key);
		if (verb==="set") {
			if (!value) throw new Error("Value not provided");
			if (!def.values.find(v=>v.value==value)) {
				throw new Error("Unknow value: " + value);
			}
		}
		if (scope==="local") {
			if (!def.canBeLocal) throw new Error("This preference can only be global");
		} else {
			let userId = ct.message.author;
			await this.upsertPref(userId, key, value);
			// updating the cache
			let gp = await exports.getUserGlobalPrefs(this, userId);
			gp[key] = value;
		}
		if (def.onchange) await def.onchange(this, ct.shoe.publicUser, key, value);
	}
	// Whatever the command, we'll need the up-to-date local prefs, so
	// we need to ask them to the browser
	ct.shoe.emit("cmd_pref", { cmd: ct.message.content });
	// The handling of the command will resume once we receive
	// the sio event with the local prefs
}

// second server part of handling a !!pref command
// arg is expected to contain
// 	- local: local prefs
// 	- cmd: the command message content
exports.handlePrefSioCommand = async function(con, shoe, arg){
	let match = arg.cmd.match(
		/^!!(!)?pref\s*(get|list|set|unset)\s*(?:local|global)?\s*(\S+)?\s*(.*)$/
	);
	if (!match) return console.log("invalid !!pref command:", arg.cmd);
	let [, priv, verb, key] = match;
	let defs = definitions.filter(d=>!key||d.key==key);
	let txt = `@${shoe.publicUser.name} ${arg.cmd.replace(/^!!!?pref\s*/, "")}\n`;
	let local = arg.local;
	let global = await exports.getUserGlobalPrefs(con, shoe.publicUser.id);
	txt += fmt.tbl({
		cols: ["key", "name", "local browser value", "global user value", "default"],
		aligns: "llccc",
		rows: defs.map(d => [d.key, d.name, local[d.key]||" ", global[d.key]||" ", d.defaultValue])
	});
	if (priv) {
		shoe.emitPersonalBotFlake(null, txt);
	} else {
		ws.botMessage(null, shoe.room.id, txt);
	}
	if (verb=="set"||verb=="unset") {
		// finally we send the merged prefs (which may have been changed by the cmd)
		//shoe.emit('prefs', shoe.userPrefs);
		// many preferences aren't dynamically handled client-side so we just reload
		shoe.emit("must_reload", "preferences changed");
	}
}

// registers the !!set command, which is used for local browser preferences
// (will probably allow server managed preferences in the future)
exports.registerCommands = function(registerCommand){
	registerCommand({
		name: 'pref',
		canBePrivate: true,
		fun: handlePrefCommand,
		help: "list, read or write preferences",
		detailedHelp:
			"You have two types of preferences:"
			+ "\n* global preferences"
			+ "\n* local preferences, set for your current browser only"
			+ "\nWhen both are defined, local preferences have priority."
			+ "\nExamples:"
			+ "\n* `!!pref describe fun` : describes all possible values of the `fun` option"
			+ "\n* `!!pref list` : list all your preferences, local and global"
			+ "\n* `!!pref set global volume 1` : set to `1` your global `volume` preference"
			+ "\n* `!!pref set local volume 0` : set to `0` the volume on your current browser"
			+ "\nIf you want to use this command privately, use `!!!pref` instead of `!!pref`."
	});
}

