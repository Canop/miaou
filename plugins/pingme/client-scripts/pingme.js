miaou(function(ed, plugins){

	plugins.pingme = {
		start: function(){
			ed.registerCommandArgAutocompleter("pingme", ["cancel", "list"]);
		}
	}
});

