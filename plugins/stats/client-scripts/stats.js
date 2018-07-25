// provide argument autocompletion for the !!stats command
miaou(function(plugins, ed){

	plugins["stats"] = {
		start: function(){
			ed.registerCommandArgAutocompleter("stats", [
				["graph", ["me", "server", "room"]],
				["hours", ["me", "server", "room"]],
				["days", ["me", "server", "room"]],
				["months", ["me", "server", "room"]],
				["prefs", ["notif", "sound", "volume", "datdpl", "nifvis", "connot", "theme", "otowat", "beta"]],
				"me",
				"user",
				"room",
				"rooms",
				"users",
				"active-rooms",
				"active-users",
				"roomusers",
				"tags",
				"tzoffsets",
				"votes",
				"sockets",
			]);
		}
	}

});

