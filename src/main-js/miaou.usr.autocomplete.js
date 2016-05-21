
;miaou(function(usr, gui, ws){

	if (gui.mobile) return;

	$("input.username").autocomplete(function(pat, cb){
		ws.emit("autocompleteping", pat, cb);
	});

});
