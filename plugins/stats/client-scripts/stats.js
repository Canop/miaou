// provide argument autocompletion for the !!stats command
miaou(function(plugins, ed, prefs){

	plugins["stats"] = {
		start: function(){
			ed.registerCommandArgAutocompleter("stats", [
				["graph", ["me", "server", "room"]],
				["hours", ["me", "server", "room"]],
				["days", ["me", "server", "room"]],
				["months", ["me", "server", "room"]],
				["prefs", prefs.allKeys()],
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
				"web-push",
			]);
		}
	}

});

