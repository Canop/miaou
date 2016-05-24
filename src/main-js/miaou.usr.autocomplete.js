
;miaou(function(usr, gui, ws){

	if (gui.mobile) return;

	$("input.username").autocomplete(function(pat, cb){
		ws.emit("completeusername", {start:pat, roomAuthors:true}, cb);
	});

});
