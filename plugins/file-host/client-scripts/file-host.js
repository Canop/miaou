// provide supplementarty autocompletion for the !!stats command
miaou(function(plugins, ed){

	plugins["file-host"] = {
		start: function(){
			ed.registerCommandArgAutocompleter("stats", [
				["file-host", ["global", "users", "types"]]
			]);
		}
	}

});

