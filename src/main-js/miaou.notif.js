// manages the list and dispatching of notifications

miaou(function(notif, chat, horn, locals, md, ws){
				
	//~ le ping concernant un message que tu as probablement vu (tu étais là peu avant ou la fenêtre était visible)
	 //~ n'apparait pas tout de suite (il est dans un état non acquité mais non visible) et il est automatiquement
	  //~ acquité si tu écris peu après, ou si tu réponds
				
	// $m is a reference to the message element (useful when there's no message id)
	var	notifications = [], // array of {r:roomId, rname:roomname, mid:messageid, $m:message}
		notifMessage, // an object created with md.notificationMessage displaying notifications
		nbUnseenMessages = 0,
		lastUserAction = 0; // ms
	
	// called in case of user action proving he's right in front of the chat so
	//  we should not ping him
	notif.userAct = function(){
		lastUserAction = Date.now();
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
		var	localPings = [], otherRooms = {};
		notifications.forEach(function(n){
			if (locals.room.id==n.r) localPings.push(n);
			else otherRooms[n.r] = n.rname;
		});
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
		// we assume here there's at most one notification to a given message
		for (var i=0; i<notifications.length; i++) {
			if (notifications[i].mid===mid) {
				notifications.splice(i, 1);
				notif.updatePingsList();
				return;
			}
		}
	}
	
	// called in case of new message (or a new important event related to a message)
	notif.touch = function(mid, ping, from, text, r, $md){
		r = r || locals.room;
		var	visible = vis(),
			userDidntJustAct = Date.now()-lastUserAction>1500;
		if (ping && (mid||$md) && userDidntJustAct && !$('#mwin[mid='+mid+']').length) {
			notif.pings([{r:r.id, rname:r.name, mid:mid, $md:$md}]);
		}
		if (!visible || locals.userPrefs.nifvis==="yes") {
			if (
				( locals.userPrefs.notif==="on_message" || (ping && locals.userPrefs.notif==="on_ping") )
				 && userDidntJustAct
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
		vis(function(){
			if (vis()) {
				nbUnseenMessages = 0;
				notif.updateTab(0, 0);
				$('#input').focus();
			}
		});
	}
});
