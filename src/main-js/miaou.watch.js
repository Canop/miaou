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
			$('<a>').addClass('watch').attr('rid', w.id).attr('title', w.name)
			.attr('href', w.id+'?pad=true') // TODO better links with room name
			.append($('<span>').addClass('count'))
			.append($('<span>').addClass('name').text(w.name))
			.appendTo('#watches')
		});
	}

	watch.remove = function(roomId){
		$('#watches .watch[rid='+roomId+']').remove();
	}

	watch.incr = function(roomId){
		console.log('watch increment', roomId);
		var $wc =  $('#watches .watch[rid='+roomId+'] .count');
		if (!$wc.length) return console.log('no watch!');
		$wc.text((+$wc.text()||0)+1);
	}

	watch.raz = function(roomId){
		console.log('watch raz', roomId);
		 $('#watches .watch[rid='+roomId+'] .count').empty();
	}
	
	$('#watches').on('mouseenter', '.watch', function(){
		
	})
});
