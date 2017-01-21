miaou(function(plugins, ed){

	function autocompleteArg(ac){
		if (ac.previous) return null;
		return ["list", "watch", "unwatch"].filter(function(n){
			return !n || !n.indexOf(ac.arg);
		});
	}

	plugins["scm-hooks"] = {
		start: function(){
			ed.registerCommandArgAutocompleters("github", autocompleteArg);
		}
	}

});

