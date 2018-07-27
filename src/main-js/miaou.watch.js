// functions related to user watching other rooms

miaou(function(watch, chat, fish, gui, locals, md, notif, prefs, usr, ws){

	watch.enabled = false;

	// tell if the room is watched
	watch.watched = function(roomId){
		return $('#watches .watch[rid='+roomId+']').length>0;
	}

	function updateDimensions(){
		if (gui.mobile) return;
		if ($('#rooms-panel').hasClass('open')) return;
		var stripeHeight = document.getElementById('stripe').offsetHeight;
		$('.watch .name').toggleClass('compact', stripeHeight>60);
		$('#left, #right, #center').css('top', stripeHeight);
	}

	if ($('#non-top').length) $(window).resize(updateDimensions);

	watch.addLocalRoom = function(){
		$('#room-watch').hide();
		$('#room-unwatch').show();
		ws.emit('wat', locals.room.id);
		locals.room.watched = true;
	}

	// w must be {id:roomId,name:roomname,nbunseen}
	watch.add = function(watches){
		watches.forEach(function(w){
			if (w.id===locals.room.id) {
				$('#room-watch').hide();
				$('#room-unwatch').show();
				locals.room.watched = true;
				return;
			}
			if (watch.watched(w.id)) return;
			var $name = $('<span>').addClass('name');
			var otherusername = usr.interlocutor(w);
			if (otherusername) $name.text(otherusername).addClass('dialog-room');
			else $name.text(w.name);
			var href = ''+w.id; // TODO add the room name
			var $w = $('<a>').addClass('watch').attr('rid', w.id)
			.dat('watch', w)
			.append($name)
			.attr('href', href)
			.appendTo('#watches');
			var $c = $('<span>').addClass('count').text(w.nbunseen||'').prependTo($w);
			if (w.nbunseen) $w.addClass('has-unseen');
			if (w.nbrequests && (w.auth==="admin"||w.auth==="own")) $w.addClass('has-requests');
			if (notif.hasPing(w.id)) $c.addClass('ping');
		});
		$('#watches').append($('#watches .watch').detach().slice().sort(function(a, b){
			var wa = $(a).dat('watch'), wb = $(b).dat('watch');
			return	(wa.dialog-wb.dialog) ||
				(usr.interlocutor(wa)||wa.name).localeCompare((usr.interlocutor(wb)||wb.name));
		}));
		updateDimensions();
	}

	// called when the initial watches are passed by the server (i.e. The local state
	//  is the persisted one)
	watch.started = function(){
		if (/#$/.test(location)) {
			history.replaceState('', document.title, location.pathname+location.search);
		}
		if (locals.room.watched) return;
		if (prefs.get("otowat")==="on_visit") {
			watch.addLocalRoom();
		} else if (prefs.get("otowat")==="on_post") {
			chat.on('sending_message', function(){
				if (!locals.room.watched) {
					watch.addLocalRoom();
				}
			});
		}
	}

	watch.remove = function(roomId){
		$('#watches .watch[rid='+roomId+']').remove();
		if (roomId===locals.room.id) locals.room.watched = false;
		$('#watch').text('watch');
		updateDimensions();
	}

	watch.incr = function(incr){
		if (incr.f===locals.me.id) {
			console.log("dismissing watch increment from self");
			return;
		}
		var roomId = incr.r;
		var $w =  $('#watches .watch[rid='+roomId+']');
		if (!$w.length) return console.log('no watch!');
		$w.addClass('has-unseen');
		var $wc = $w.find('.count');
		$wc.text((+$wc.text()||0)+1);
		notif.setHasWatchUnseen(true);
		updateDimensions();
		updateGlobalIcon();
	}

	function updateGlobalIcon(){
		// the icon sum of all watches, if it exists (i.e. on mpad)
		var $globalIcon = $('#global-watch');
		if (!$globalIcon.length) return;
		$globalIcon
		.toggleClass('ping', !!$('.watch.ping,.watch.has-requests').length)
		.toggleClass('has-unseen', !!$('.watch.has-unseen').length);
	}

	watch.setPings = function(roomIds){
		$('#watches .watch .count').removeClass('ping');
		roomIds.forEach(function(rid){
			$('#watches .watch[rid='+rid+'] .count').addClass('ping');
		});
		updateGlobalIcon();
	}

	// increment or decrement the number of access requests in a watched room
	watch.incrRequests = function(roomId, diff){
		var $w =  $('#watches .watch[rid='+roomId+']');
		if (!$w.length) return console.log('no watch!');
		var w = $w.dat('watch');
		w.nbrequests = (w.nbrequests||0)+diff;
		$w.toggleClass("has-requests", !!w.nbrequests);
		updateGlobalIcon();
	}

	watch.raz = function(roomId){
		$('#watches .watch[rid='+roomId+'] .count').removeClass('has-unseen').empty();
		if (!$('.watch .count.has-unseen').length) notif.setHasWatchUnseen(false);
		updateDimensions();
		updateGlobalIcon();
	}

	watch.unseens = function(){
		var m = {};
		$('#watches .watch').each(function(){
			var	rid = $(this).attr('rid'),
				count = +$('.count', this).text();
			if (count) m[rid] = count;
		});
		return m;
	}

	watch.watch = function(roomId){
		return $('#watches .watch[rid='+roomId+']').dat('watch');
	}

	var requiredrid;
	$('#watches').on('click', '.watch', function(){
		notif.userAct();
		var w = $(this).dat('watch');
		if (w.last_seen) {
			localStorage.destMessage = w.last_seen;
		}
	});

	if (gui.mobile) return;

	$('#watches').on('mouseenter', '.watch', function(){
		fish.closeBubbles();
		$('.watch').removeClass('open').find('.watch-panel').remove();
		var	$w = $(this), w = $w.dat('watch'), entertime = Date.now(),
			off = $w.offset(), ww = $(window).width(),
			nbunseen = +$w.find('.count').text()||0,
			nbrequestedmessages = Math.min(20, Math.max(5, nbunseen));
		requiredrid = w.id;
		function display(dat){
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
			if (w.nbrequests) {
				var text = w.nbrequests+" unanswered access request";
				if (w.nbrequests>1) text += "s";
				$("<a>").addClass("watch-requests")
				.attr("href", "auths?id="+w.id)
				.text(text).appendTo($panel);
			}
			var $ml = $('<div>').addClass('messages').appendTo($panel);
			$w.addClass('open');
			if (dat.error) {
				return $ml.text("Error: "+dat.error);
			}
			md.showMessages(dat.messages.reverse(), $ml);
			$ml.find('.message').each(function(i){
				if (i>=dat.messages.length-nbunseen) $(this).addClass('unseen');
			});
			$ml.scrollTop($ml[0].scrollHeight);
			if (nbunseen) {
				$w.one('mouseleave', function(){
					ws.emit('watch_raz', requiredrid);
					$('.count', this).empty()
				});
			}
		}
		$.get('json/messages/last?n='+nbrequestedmessages+'&room='+w.id, function(dat){
			setTimeout(display, 250 + entertime - Date.now(), dat);
		});
	}).on('mouseleave', '.watch', function(){
		requiredrid = 0;
		$('.watch').removeClass('open').find('.watch-panel').remove();
	});
});
