
miaou(function(prefs, chat, ed, locals, md, ws){

	var	definitions, // not always defined, normally available in chat
		defaults = {},
		localPrefsPrefix = locals.me ? `miaou.${locals.me.id}.prefs.` : "miaou.prefs.",
		valmap,
		merged;

	(function migratePrefs(){
		if (!locals.me) return;
		// Prefs are now user specific. We migrate old prefs to avoid losing some.
		// This function will disappear after a few weeks
		Object.keys(localStorage).forEach(k => {
			let m = k.match(/^miaou\.prefs\.(\w+)$/);
			if (!m) return;
			localStorage.setItem(localPrefsPrefix+m[1], localStorage.getItem(k));
			localStorage.removeItem(k);
		});
	})();

	function local(key, value){
		var lsk = localPrefsPrefix + key;
		if (value===undefined) return localStorage.getItem(lsk);
		if (value===null) return localStorage.removeItem(lsk);
		localStorage.setItem(lsk, value);
	}

	prefs.allKeys = function(){
		if (definitions) {
			return definitions.map(d => d.key);
		}
		return Object.keys(localStorage)
		.filter(k => k.startsWith(localPrefsPrefix))
		.map(k => k.slice(localPrefsPrefix.length));
	}

	prefs.allLocalPrefs = function(){
		return prefs.allKeys().reduce((m, k)=>{
			var v = local(k)
			if (v) m[k] = v;
			return m;
		}, {});
	}

	// initialization, using prefDefinitions and userGlobalPrefs provided
	// in page's locals
	definitions = locals.prefDefinitions; // not always defined, depends on the page
	if (definitions) {
		valmap = definitions.reduce((m, d) => m.set(d.key, d.values.map(v=>""+v.value)), new Map);
		defaults = definitions.reduce((m, d) => {
			m[d.key]=d.defaultValue; return m;
		}, {});
		ed.registerCommandArgAutocompleter("pref", matcher);
	}
	if (locals.userGlobalPrefs) { // depends on the page, too
		merged = Object.assign(
			defaults,
			locals.userGlobalPrefs,
			prefs.allLocalPrefs()
		);
		console.log('merged preferences:', merged);
	} else {
		console.log("no userGlobalPrefs in locals");
	}

	prefs.get = function(key){
		if (!merged) {
			console.log("trying to read prefs and they're not available. key=", key);
			// we send the local ones
			return local(key);
		}
		return merged[key];
	}

	function matcher(ac){
		var path = ac.args.split(" ");
		path.pop();
		var depth = path.length;
		if (depth==0) return ["describe", "get", "list", "set", "unset"];
		switch (path[0]) {
		case "describe":
		case "get":
			return depth==1 ? prefs.allKeys() : undefined;
		case "list":
			return;
		case "set":
			if (depth==1) return ["local", "global"];
			if (depth==2) return prefs.allKeys();
			if (depth==3) return valmap.get(path[2]);
			return;
		case "unset":
			if (depth==1) return ["local", "global"];
			if (depth==2) return prefs.allKeys();
			return;
		default:
			return;
		}
	}

	// called on 'cmd_pref' sio event, which is part of the !!pref command handling workflow
	prefs.handleCmdPref = function(arg){
		if (arg.cmd) {
			var localMatch = arg.cmd.match(/^!!!?pref\s*(set|unset)\s*local\s*(\S+)\s*(.+)?$/);
			if (localMatch) {
				var verb = localMatch[1];
				var key = localMatch[2];
				var value = localMatch[3];
				local(key, verb=="set" ? value : null);
			}
		}
		ws.emit("prefs", {
			local: prefs.allLocalPrefs(),
			cmd: arg.cmd
		});
	}

	prefs.funLowerThan = function(min){
		// in case of doubt we say yes
		if (!definitions || !merged) return true;
		for (var i=definitions.length; i--;) {
			if (definitions[i].key!="fun") continue;
			var values = definitions[i].values.map(v=>v.value);
			var value = merged["fun"];
			return value && values.indexOf(min)>values.indexOf(value);
		}
		return true;
	}

});
