// manages the list and dispatching of notifications

miaou(function(notif, chat, horn, locals, md, watch, ws){
				
	var	notifications = [], // array of {r:roomId, rname:roomname, mid:messageid}
		notifMessage, // an object created with md.notificationMessage displaying notifications
		nbUnseenMessages = 0,
		lastUserAction = 0; // ms
	
	function lastNotificationInRoom(){
		for (var i=notifications.length; i--;) {
			if (notifications[i].r==locals.room.id) return notifications[i];
		}
	}
	
	notif.log = function(){ // for console
		return notifications; 
	}
	
	// called in case of user action proving he's right in front of the chat so
	//  we should not ping him
	// If the user action is related to a message, its mid is passed
	notif.userAct = function(mid){
		lastUserAction = Date.now();
		// we assume the user sees the most recent messages if he acts
		$('#messages .message:gt(-4)').each(function(){
			notif.removePing($(this).attr('mid'), true, true);
		});
		notif.removePing(mid, true, true);
	}
	
	// goes to next ping in the room. Return true if there's still another one after that
	notif.nextPing = function(){
		var done = false;
		for (var i=0; i<notifications.length; i++) {
			if (notifications[i].r==locals.room.id) {
				if (done) {
					return true;
				} else {
					md.focusMessage(notifications[i].mid);
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
			if (locals.room.id==n.r) {
				localPings.push(n);
			} else {
				otherRooms[n.r] = n.rname;
			}
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
			if (!ping.mid) console.log("ERROR MISSING ID");// temp assert
			if (!map[ping.mid]) {
				notifications.push(ping);
				changed = true;
			}
		});
		notifications.sort(function(a,b){ return a.mid-b.mid }); // this isn't perfect as some notifications are related to flakes
		if (changed) notif.updatePingsList();
	}
	
	notif.removePing = function(mid, forwardToServer, flash){
		if (!mid) return;
		// we assume here there's at most one notification to a given message
		for (var i=0; i<notifications.length; i++) {
			if (notifications[i].mid==mid) {
				if (flash) {
					var $md = $('#messages .message[mid='+mid+']');
					if ($md.length) {
						md.goToMessageDiv($md);
					}
				}
				if (forwardToServer) ws.emit("rm_ping", mid); // TODO know if the ping is saved in db to avoid useless messages
				notifications.splice(i, 1);
				notif.updatePingsList();
				return;
			}
		}
	}
	
	notif.watchIncr = function(){
		notif.updateTab(!!notifications.length, nbUnseenMessages+1);
	}
	notif.watchRaz = function(){
		notif.updateTab(!!notifications.length, nbUnseenMessages);
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
				if (mid) notif.pings([{r:r.id, rname:r.name, mid:mid}]);
				else if ($md) md.goToMessageDiv($md);
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
		} else if (watch.hasUnseen()) { // this part is probably useless... to be reviewed
			icon += '-new';			
		}
		document.title = title;
		console.log('favicon:', icon);
		$('#favicon').attr('href', icon+'.png');
	}

	var lastfocustime = 0;
	function onfocus(){
		var now = Date.now();
		if (now-lastfocustime<1000) return;
		lastfocustime = now;
		ws.emit('watch_raz');
		nbUnseenMessages = 0;
		notif.updateTab(0, 0);
		// we go to the last notification message, highlight it and remove the ping
		var ln = lastNotificationInRoom();
		if (ln) notif.removePing(ln.mid, true, true);
		$('#input').focus();
		notif.userAct();
	}

	notif.init = function(){
		$(window).on('focus', onfocus);
		vis(function(){
			if (vis()) onfocus();
		});
	}
});
