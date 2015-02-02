// functions related to user watching other rooms

miaou(function(watch, locals){

	// tell if the room is watched
	watch.watched = function(roomId){
		return $('#watches .watch[rid='+roomId+']').length>0;
	}
	
	// w must be {id:roomId,name:roomname}
	watch.add = function(watches){
		console.log("watch add", watches);
		watches.forEach(function(w){
			if (w.id===locals.room.id || watch.watched(w.id)) return;
			$('<div>').addClass('watch').attr('rid', w.id).attr('title', w.name)
			.append($('<span>').addClass('count'))
			.append($('<span>').addClass('name').text(w.name))
			.appendTo('#watches')
		});
	}

	watch.remove = function(roomId){
		$('#watches .watch[rid='+roomId+']').remove();
	}

	
});
