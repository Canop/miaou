// functions related to user watching other rooms

miaou(function(watch, locals, md, ws){

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

	var mustclose;
	$('#watches').on('mouseenter', '.watch', function(){
		mustclose = false;
		var $w = $(this), off = $w.offset(), ww = $(window).width();
		$.get('/json/messages/last?n=5&room='+$w.attr('rid'), function(data){
			if (mustclose) return;
			var	nbunseen = +$w.find('.count').text(),
				dl = Math.min(200, off.left-3),
				dr = Math.min(200, ww-(off.left+dl)-3);
			var $ml = $('<div>').addClass('messages').css({
				top: $w.height()+10,
				left: -dl,
				right: -dr, 
			}).appendTo($w);
			$w.addClass('open');
			if (data.error) {
				return $ml.text("Error: "+data.error);
			}
			
			if (!(nbunseen>data.messages.length)) {
				$w.find('.count').empty();
				ws.emit('watch_raz');
			}
			md.showMessages(data.messages.reverse(), $ml);
			$ml.scrollTop($ml[0].scrollHeight);
		});
	}).on('mouseleave', '.watch', function(){
		mustclose = true;
		$('.watch').removeClass('open').find('.messages').remove();
	});
});
