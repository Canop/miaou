// manages the list and dispatching of notifications

miaou(function(notif, chat, gui, horn, locals, md, prefs, watch, ws){

	var	notifications = [], // array of {r:roomId, rname:roomname, mid:messageid}
		notifMessage, // an object created with md.notificationMessage displaying notifications
		hasWatchUnseen = false,
		nbUnseenMessages = 0,
		lastUserAction = 0; // ms

	function lastNotificationInRoom(roomId){
		for (var i=notifications.length; i--;) {
			if (notifications[i].r==(roomId||locals.room.id)) return notifications[i];
		}
	}

	notif.log = function(){ // for console
		return notifications;
	}

	// tells whether there's a ping related to that room
	notif.hasPing = function(roomId){
		return !!lastNotificationInRoom(roomId);
	}

	// called in case of user action proving he's right in front of the chat so
	//  we should not ping him
	// If the user action is related to a message, its mid is passed
	notif.userAct = function(mid){
		lastUserAction = Date.now();
		// we assume the user sees the most recent messages if he acts
		$('#messages .message:gt(-10)').each(function(){
			notif.removePing($(this).attr('mid'), true, true);
		});
		notif.removePing(mid, true, true);
	}

	// goes to next ping in the room. Return true if there's still another one after that
	notif.nextPing = function(){
		lastUserAction = Date.now();
		var done = false;
		for (var i=0; i<notifications.length; i++) {
			if (notifications[i].r==locals.room.id) {
				if (done) {
					return true;
				} else {
					md.focusMessage(notifications[i].mid);
					ws.emit("rm_ping", notifications[i].mid);
					notifications.splice(i++, 1);
					done = true;
				}
			}
		}
		return false;
	}

	notif.clearPings = function(roomId){
		let mids = [];
		for (var i=notifications.length; i--;) {
			if (!roomId || notifications[i].r==roomId) {
				mids.push(notifications[i].mid);
				notifications.splice(i, 1);
			}
		}
		if (!mids.length) return;
		ws.emit('rm_pings', mids);
		notif.updatePingsList();
	}

	notif.updatePingsList = function(){
		if (!vis()) notif.updateTab(!!notifications.length, nbUnseenMessages);
		if (!notifications.length) {
			if (notifMessage) notifMessage.$md.slideUp($.fn.remove);
			notifMessage = null;
			watch.setPings([]);
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
				$('<div>').addClass('pingroom').append(
					$('<span>').text(
						localPings.length +
						(localPings.length>1 ? ' pings' : ' ping') + ' in this room.'
					)
				).append(
					$('<button>').addClass('nextping').text("Next ping").click(function(){
						notif.nextPing();
						notif.updatePingsList();
					})
				).append(
					$('<button>').addClass('clearpings').text('clear').click(function(){
						notif.clearPings(locals.room.id);
					})
				).appendTo($c)
			}
			var	otherRoomIds = Object.keys(otherRooms),
				nbotherrooms = otherRoomIds.length;
			if (nbotherrooms) {
				var t = "You've been pinged in room";
				if (nbotherrooms>1) t += 's';
				var $otherrooms = $('<div>').append($('<span>').text(t)).appendTo($c);
				$.each(otherRooms, function(r, rname){
					var $brs = $('<div>').addClass('pingroom').appendTo($otherrooms);
					$('<button>').addClass('openroom').text(rname).click(function(){
						ws.emit('watch_raz');
						setTimeout(function(){	location = r; }, 250); // timeout so that the raz is sent
					}).appendTo($brs);
					$('<button>').addClass('clearpings').text('clear').click(function(){
						notif.clearPings(r);
					}).appendTo($brs);
				});
				watch.setPings(otherRoomIds);
			}
		});
	}

	// add pings to the list and update the GUI
	notif.pings = function(pings){
		var	changed = false,
			visible = vis(),
			lastUserActionAge = Date.now()-lastUserAction,
			map = notifications.reduce(function(map, n){ map[n.mid]=1;return map; }, {});
		pings.forEach(function(ping){
			if (map[ping.mid]) return;
			if (ping.r===locals.room.id && lastUserActionAge < 15000) {
				ws.emit("rm_ping", ping.mid);
				return;
			}
			notifications.push(ping);
			changed = true;
			if (
				prefs.get("notif")!=="never"
				&& (!visible || prefs.get("nifvis")==="yes")
			) {
				horn.show(ping.mid, ping.rname, ping.authorname, ping.content);
			}
		});
		notifications.sort(function(a, b){ return a.mid-b.mid });
		if (changed) notif.updatePingsList();
	}

	// called by the server or (most often) in case of any action on a message
	//  (so this is very frequently called on non pings)
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
				if (forwardToServer) ws.emit("rm_ping", mid);
				notifications.splice(i, 1);
				notif.updatePingsList();
				return;
			}
		}
	}

	notif.removePings = function(mids){
		mids.forEach(mid => notif.removePing(mid));
	}

	notif.setHasWatchUnseen = function(b){
		hasWatchUnseen = b;
		if (!vis()) notif.updateTab(!!notifications.length, nbUnseenMessages);
	}

	// called in case of new message (or a new important event related to a message)
	// FIXME : it's also called if the message isn't really new (loading old pages)
	notif.touch = function(mid, ping, from, text, r, $md){
		r = r || locals.room;
		var	visible = vis(),
			lastUserActionAge = Date.now()-lastUserAction;
		if (ping && (mid||$md) && !$('#mwin[mid='+mid+']').length) {
			if (visible  && lastUserActionAge<2000) {
				md.goToMessageDiv(mid||$md);
				return;
			}
			if (lastUserActionAge>15000) {
				if (mid) notif.pings([{r:r.id, rname:r.name, mid:mid, authorname:from, content:text}]);
				else if ($md) md.goToMessageDiv($md);
			}
		}
		if (!visible || prefs.get("nifvis")==="yes") {
			if (
				( prefs.get("notif")==="on_message" || (ping && prefs.get("notif")==="on_ping") )
				&& lastUserActionAge>500
			) {
				horn.show(mid, r||locals.room, from, text);
			}
		}
		if (!visible) notif.updateTab(!!notifications.length, ++nbUnseenMessages);
	}

	notif.updateTab = function(hasPing, nbUnseenMessages){
		var	title = locals.room.name,
			icon = 'static/M-32';
		if (hasPing) {
			title = '*'+title;
			icon += '-ping';
		} else if (nbUnseenMessages) {
			title = nbUnseenMessages+'-'+title;
			icon += '-new';
		} else if (hasWatchUnseen && !vis()) {
			icon += '-new';
		}
		document.title = title;
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
		if (!gui.mobile) $('#input').focus();
		notif.userAct();
	}

	notif.init = function(){
		$(window).on('focus', onfocus);
		vis(function(){
			if (vis()) onfocus();
		});
	}
});
