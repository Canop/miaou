// functions related to user watching other rooms

miaou(function(watch, locals, md, notif, ws){
	
	// this is false for mobile users
	watch.enabled = false;

	// tell if the room is watched
	watch.watched = function(roomId){
		return $('#watches .watch[rid='+roomId+']').length>0;
	}
	
	function updateDimensions(){
		$('.watch .name').toggleClass('compact', $('#stripe-top').height()>60);
		$('#left, #right, #center').css('top', $('#stripe-top').height());
	}
	
	if ($('#non-top').length) $(window).resize(updateDimensions);
	
	// if the room is a dialog room and we guess the name of the other user, return this name
	function interlocutor(w){
		if (!w.dialog) return;
		var names = w.name.match(/^([a-zA-Z][\w\-]{2,19}) & ([a-zA-Z][\w\-]{2,19})$/);
		if (!names) return;
		if (names[1]===locals.me.name) return names[2];
		if (names[2]===locals.me.name) return names[1];
	}
	
	// w must be {id:roomId,name:roomname}
	watch.add = function(watches){
		watches.forEach(function(w){
			if (w.id===locals.room.id) {
				locals.room.watched = true;
				$('#watch').text('unwatch');
				return;
			}
			if (watch.watched(w.id)) return;
			var $name = $('<span>').addClass('name');
			var otherusername = interlocutor(w);
			if (otherusername) $name.text(otherusername).addClass('dialog-room');
			else $name.text(w.name);
			$('<a>').addClass('watch').attr('rid', w.id)
			.attr('href', w.id) // TODO better links with room name
			.data('watch', w)
			.append($('<span>').addClass('count'))
			.append($name)
			.appendTo('#watches')
		});
		$('#watches').append($('#watches .watch').detach().slice().sort(function(a,b){
			var wa = $(a).data('watch'), wb = $(b).data('watch');
			return (interlocutor(wa)||wa.name).localeCompare((interlocutor(wb)||wb.name));
		}));
		updateDimensions();
	}

	watch.remove = function(roomId){
		$('#watches .watch[rid='+roomId+']').remove();
		if (roomId===locals.room.id) locals.room.watched = false;
		$('#watch').text('watch');
		updateDimensions();
	}

	watch.incr = function(roomId){
		var $wc =  $('#watches .watch[rid='+roomId+'] .count');
		if (!$wc.length) return console.log('no watch!');
		$wc.text((+$wc.text()||0)+1);
		notif.setHasWatchUnseen(true);
		updateDimensions();
	}

	watch.raz = function(roomId){
		 $('#watches .watch[rid='+roomId+'] .count').empty();
		 if (!$('.watch .count:not(:empty)').length) notif.setHasWatchUnseen(false);
		updateDimensions();
	}

	var requiredrid;
	$('#watches').on('mouseenter', '.watch', function(){
		$('.watch').removeClass('open').find('.watch-panel').remove();
		var	$w = $(this), w = $w.data('watch'), entertime = Date.now(),
			off = $w.offset(), ww = $(window).width(),
			nbunseen = +$w.find('.count').text()||0,
			nbrequestedmessages = Math.min(20, Math.max(5, nbunseen));
		requiredrid = w.id;
		function display(data){
			if (requiredrid!==w.id) return;
			var	dr = Math.max(Math.min(200, ww-off.left-$w.width()-30), 0),
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
			md.showMessages(data.messages.reverse(), $ml);
			$ml.find('.message').each(function(i){
				if (i>=data.messages.length-nbunseen) $(this).addClass('unseen');
			});
			$ml.scrollTop($ml[0].scrollHeight);
			$w.one('mouseleave', function(){ $('.count', this).empty() });
		}
		$.get('json/messages/last?n='+nbrequestedmessages+'&room='+w.id, function(data){
			setTimeout(display, 250 + entertime - Date.now(), data);
		});
	}).on('mouseleave', '.watch', function(){
		requiredrid = 0;
		$('.watch').removeClass('open').find('.watch-panel').remove();
		ws.emit('watch_raz');
	});
});
