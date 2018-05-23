// provide argument autocompletion for the !!stats command
miaou(function(plugins, ed){

	const argSequences = [
		["graph", ["me", "server", "room"]],
		["hours", ["me", "server", "room"]],
		["prefs", ["notif", "sound", "volume", "datdpl", "nifvis", "connot", "theme", "otowat", "beta"]],
		["me"],
		["user"],
		["room"],
		["rooms"],
		["users"],
		["active-rooms"],
		["active-users"],
		["roomusers"],
		["tags"],
		["tzoffsets"],
		["votes"],
		["sockets"],
	];
	const NB_DEEP_ARGS = 2;
	const firstArgs = argSequences.map(function(v){
		return v[0];
	});

	function autocompleteArg(ac){
		if (!ac.previous) return firstArgs;
		for (var i=0; i<NB_DEEP_ARGS; i++) {
			var arr = argSequences[i];
			if (arr.length>1 && arr[0]===ac.previous) {
				return arr[1];
			}
		}
	}

	plugins["stats"] = {
		start: function(){
			ed.registerCommandArgAutocompleter("stats", autocompleteArg);
		}
	}

});

