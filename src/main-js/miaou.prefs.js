
miaou(function(prefs, chat, ed, locals, md){

	const localSettingsDefinitions = {
		fun: [ "none", "low", "normal", "high", "max" ],
	};

	function autocompleteArg(ac){
		if (!ac.previous) return ["local"];
		if (ac.previous==="local") return Object.keys(localSettingsDefinitions);
		return localSettingsDefinitions[ac.previous];
	}

	function localPref(name, value){
		var key = "pref."+name;
		if (value) {
			localStorage.setItem(key, value);
		} else {
			return localStorage.getItem(key);
		}
	}

	prefs.get = function(name){
		return localPref(name) || (locals.userPrefs||{})[name];
	}

	prefs.funLowerThan = function(min){
		var	value = prefs.get("fun"),
			values = localSettingsDefinitions.fun;
		return value && values.indexOf(min)>values.indexOf(value);
	}

	chat.on("ready", function(){
		ed.registerCommandArgAutocompleter("set", autocompleteArg);
	})
	.on("sending_message", function(m){
		var match = m.content && m.content.match(/^!!set local\s+(\S+)(?:\s+(\S+))?\s*$/);
		if (!match) return;
		var	name = match[1],
			value = match[2],
			values = localSettingsDefinitions[name];
		if (!values) {
			md.showError(name + " isn't a known local setting");
			return false;
		}
		if (value) {
			if (values.indexOf(value)===-1) {
				md.showError("Possible values for " + name + " are "+values);
				return false;
			}
			localPref(name, value);
		} else {
			value = localPref(name);
		}
		md.notificationMessage(function($c){
			$c.append(
				$("<b>").text("Local Browser Settings: "),
				$("<span>").text(name + " = " + localPref(name))
			);
		});
	});

});
