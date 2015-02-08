// functions related to user watching other rooms

miaou(function(watch, locals, md, notif, ws){

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
			.data('watch', w)
			.append($('<span>').addClass('count'))
			.append($('<span>').addClass('name').text(w.name))
			.appendTo('#watches')
		});
		$('#watches').append($('#watches .watch').detach().slice().sort(function(a,b){
			return $(a).data('watch').name.localeCompare($(b).data('watch').name);
		}));
	}

	watch.remove = function(roomId){
		$('#watches .watch[rid='+roomId+']').remove();
	}

	watch.incr = function(roomId){
		var $wc =  $('#watches .watch[rid='+roomId+'] .count');
		if (!$wc.length) return console.log('no watch!');
		$wc.text((+$wc.text()||0)+1);
		notif.setHasWatchUnseen(true);
	}

	watch.raz = function(roomId){
		 $('#watches .watch[rid='+roomId+'] .count').empty();
		 if (!$('.watch .count:not(:empty)').length) notif.setHasWatchUnseen(false);
	}

	var requiredrid;
	$('#watches').on('mouseenter', '.watch', function(){
		$('.watch').removeClass('open').find('.watch-panel').remove();
		var	$w = $(this), w = $w.data('watch'),
			off = $w.offset(), ww = $(window).width();
		requiredrid = w.id;
		$.get('json/messages/last?n=5&room='+w.id, function(data){
			if (requiredrid!==w.id) return;
			var	nbunseen = +$w.find('.count').text(),
				dr = Math.max(Math.min(200, ww-off.left-$w.width()-30), 0),
				dl = -500+$w.width()+dr;
			var $panel = $('<div>').addClass('watch-panel').css({
				top: $w.height()+5, left: dl, right: -dr, 
			}).appendTo($w);
			var $top = $('<div>').addClass('watch-panel-top').appendTo($panel);
			$('<span>').text(w.name).appendTo($top);
			$('<button>').addClass('small').text('unwatch').click(function(){
				ws.emit('unwat', w.id);
				$w.remove();
				return false;
			}).appendTo($top);
			var $ml = $('<div>').addClass('messages').appendTo($panel);
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
		$('.watch').removeClass('open').find('.watch-panel').remove();
	});
});
