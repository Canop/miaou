miaou(function(plugins, ed){

	plugins["scm-hooks"] = {
		start: function(){
			ed.registerCommandArgAutocompleter("github", ["list", "watch", "unwatch"]);
		}
	}

});

