// functions related to user watching other rooms

miaou(function(watch, locals, md, ws){

	// tell if the room is watched
	watch.watched = function(roomId){
		return $('#watches .watch[rid='+roomId+']').length>0;
	}
	
	// w must be {id:roomId,name:roomname}
	watch.add = function(watches){
		watches.forEach(function(w){
			if (w.id===locals.room.id || watch.watched(w.id)) return;
			$('<a>').addClass('watch').attr('rid', w.id)
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
		var $wc =  $('#watches .watch[rid='+roomId+'] .count');
		if (!$wc.length) return console.log('no watch!');
		$wc.text((+$wc.text()||0)+1);
	}

	watch.raz = function(roomId){
		 $('#watches .watch[rid='+roomId+'] .count').empty();
	}

	var requiredrid;
	$('#watches').on('mouseenter', '.watch', function(){
		$('.watch').removeClass('open').find('.messages').remove();
		var $w = $(this), off = $w.offset(), ww = $(window).width();
		var rid = +$w.attr('rid');
		requiredrid = rid;
		$.get('json/messages/last?n=5&room='+requiredrid, function(data){
			if (requiredrid!==rid) return;
			var	nbunseen = +$w.find('.count').text(),
				dl = Math.min(200, off.left-4),
				dr = Math.min(200, ww-(off.left+dl)-4);
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
		requiredrid = 0;
		$('.watch').removeClass('open').find('.messages').remove();
	});
});
