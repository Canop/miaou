// manages the list and dispatching of notifications

miaou(function(notif, chat, horn, locals, md, ws){
				
	// TODO : save the ping in db when it was never displayed ?
				
	// $md is a reference to the message element (useful when there's no message id)
	var	notifications = [], // array of {r:roomId, rname:roomname, mid:messageid, $md:message}
		notifMessage, // an object created with md.notificationMessage displaying notifications
		nbUnseenMessages = 0,
		lastUserAction = 0; // ms
	
	function lastNotificationInRoom(){
		for (var i=notifications.length; i--;) {
			if (notifications[i].r==locals.room.id) return notifications[i];
		}
	}
	
	// called in case of user action proving he's right in front of the chat so
	//  we should not ping him
	// If the user action is related to a message, its mid is passed
	notif.userAct = function(mid){
		lastUserAction = Date.now();
		notif.removePing(mid);
		// we assume the user sees the most recent messages if he acts
		$('#messages .message:gt(-4)').each(function(){
			notif.removePing($(this).attr('mid'));
		});
	}
	
	// goes to next ping in the room. Return true if there's still another one after that
	notif.nextPing = function(){
		var done = false;
		for (var i=0; i<notifications.length; i++) {
			if (notifications[i].r==locals.room.id) {
				if (done) {
					return true;
				} else {
					if (notifications[i].$md) md.goToMessageDiv(notifications[i].$md);
					else md.focusMessage(notifications[i].mid);
					ws.emit("rm_ping", notifications[i].mid);
					notifications.splice(i++, 1);
				}
			}
		}
		return false;
	}

	notif.updatePingsList = function(){
		if (!vis()) notif.updateTab(!!notifications.length, nbUnseenMessages);
		if (!notifications.length) {
			if (notifMessage) notifMessage.$md.slideUp($.fn.remove);
			notifMessage = null;
			return;
		}
		if (notifMessage) notifMessage.remove();
		var	localPings = [], otherRooms = {}, nbvisible = 0;
		notifications.forEach(function(n){
			if (locals.room.id==n.r) {
				localPings.push(n);
				var $m = n.$m || $('#messages .message[mid='+n.mid+']');
				if ($m && $m.length && $m.offset().top>10) nbvisible++;
			} else {
				otherRooms[n.r] = n.rname;
			}
		});
		if (nbvisible>=notifications.length) return;
		notifMessage = md.notificationMessage(function($c){
			if (localPings.length) {
				$('<div>').append(
					$('<span>').text(localPings.length + (localPings.length>1 ? ' pings' : ' ping') + ' in this room.')
				).append(
					$('<button>').text("Next ping").click(function(){
						notif.nextPing();
						notif.updatePingsList();
					})
				).appendTo($c)
			}
			var nbotherrooms = Object.keys(otherRooms).length;
			if (nbotherrooms) {
				var t = "You've been pinged in room";
				if (nbotherrooms>1) t += 's';
				var $otherrooms = $('<div>').append($('<span>').text(t)).appendTo($c);
				$.each(otherRooms, function(r, rname){
					$otherrooms.append($('<button>').addClass('openroom').attr('pingroom', r).text(rname).click(function(){
						window.open(r);
					}));
				});
			}	
		});
	}
	
	// add pings to the list and update the GUI
	notif.pings = function(pings){
		var	changed = false,
			map = notifications.reduce(function(map,n){ map[n.mid]=1;return map; }, {});
		pings.forEach(function(ping){
			if (!map[ping.mid]) {
				notifications.push(ping);
				changed = true;
			}
		});
		notifications.sort(function(a,b){ return a.mid-b.mid }); // this isn't perfect as some notifications are related to flakes
		if (changed) notif.updatePingsList();
	}
	
	notif.removePing = function(mid){
		if (!mid) return;
		// we assume here there's at most one notification to a given message
		for (var i=0; i<notifications.length; i++) {
			if (notifications[i].mid==mid) {
				notifications.splice(i, 1);
				notif.updatePingsList();
				return;
			}
		}
	}
	
	// called in case of new message (or a new important event related to a message)
	notif.touch = function(mid, ping, from, text, r, $md){
		r = r || locals.room;
		var	visible = vis(), lastUserActionAge = Date.now()-lastUserAction;
		if (ping && (mid||$md)) {
			if (visible  && lastUserActionAge<2000) {
				md.goToMessageDiv(mid||$md);
				return;
			}
			if (lastUserActionAge>1500 && !$('#mwin[mid='+mid+']').length) {
				notif.pings([{r:r.id, rname:r.name, mid:mid, $md:$md}]);
			}
		}
		if (!visible || locals.userPrefs.nifvis==="yes") {
			if (
				( locals.userPrefs.notif==="on_message" || (ping && locals.userPrefs.notif==="on_ping") )
				 && lastUserActionAge>500
			) {
				horn.show(mid, r||locals.room, from, text);					
			}
		}
		if (!visible) notif.updateTab(!!notifications.length, ++nbUnseenMessages);
	}

	notif.updateTab = function(hasPing, nbUnseenMessages){
		var title = locals.room.name,
			icon = 'static/M-32';
		if (hasPing) {
			title = '*'+title;
			icon += '-ping';
		} else if (nbUnseenMessages) {
			title = nbUnseenMessages+'-'+title;
			icon += '-new';
		}
		document.title = title;
		$('#favicon').attr('href', icon+'.png');
	}

	notif.init = function(){
		$(window).on('focus', notif.updatePingsList);
		vis(function(){
			if (vis()) {
				nbUnseenMessages = 0;
				notif.updateTab(0, 0);
				// we go to the last notification message, highlight it and remove the ping
				var ln = lastNotificationInRoom();
				if (ln) {
					var $md = ln.$md || $('#messages .message[mid='+ln.mid+']');
					if ($md.length) {
						console.log("going to", $md);
						md.goToMessageDiv($md);
						ws.emit("rm_ping", ln.mid);
						notif.removePing(ln.mid);
					}
				}
				$('#input').focus();
				notif.userAct();
			}
		});
	}
});
