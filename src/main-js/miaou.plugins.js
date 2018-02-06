miaou(function(plugins, locals){

	plugins.start = function(){
		locals.pluginsToStart.forEach(function(name){
			if (!plugins[name]) {
				// console.log("Missing plugin : ", name);
				return;
			}
			plugins[name].start();
		});
	}

	// add the client part of a plugin (or part of this part)
	// If called several times for the same name, object properties will be merged.
	// This should be the prefered way to add a plugin. Doing plugins[name] = ... directly
	//  is deprecated and will be removed
	plugins.add = function(name, obj){
		if (!plugins[name]) plugins[name] = Object.create(null);
		for (var key in obj) plugins[name][key] = obj[key];
	}

});
