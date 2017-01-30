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
});
