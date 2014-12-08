// manages the list and dispatching of notifications

miaou(function(notif, chat, horn){
		
		//~ ne pas scroller lorsque la fenêtre n'est pas visible
		//~ noter le dernier message vu lors du passage invisible
		//~ pour afficher un gros trait temporaire lors du retour
		
	var	notifications = [],
		nbUnseenMessages = 0,
		lastUserAction = 0; // ms
	
	// called in case of user action proving he's right in front of the chat so
	//  we should not ping him
	notif.userAct = function(){
		lastUserAction = Date.now();
	}
	
	
	// called in case of new message (or a new important event related to a message)
	notif.touch = function(mid, ping, from, text, r){
		var visible = vis();
		if (ping) {
			if (visible) {
				chat.clearPings();
			} else {
				if (mid && !chat.oldestUnseenPing) chat.oldestUnseenPing = mid;
			}
		}
		if (!visible || userPrefs.nifvis==="yes") {
			if (
				userPrefs.notif==="on_message"
				|| (ping && userPrefs.notif==="on_ping" && Date.now()-lastUserAction>1500)
			) {
				horn.show(mid, r || room, from, text);					
			}
		}
		if (!visible) notif.updateTab(chat.oldestUnseenPing, ++nbUnseenMessages);
	}

	notif.updateTab = function(hasPing, nbUnseenMessages){
		var title = room.name,
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

	vis(function(){
		if (vis()) {
				chat.nbUnseenMessages = 0;
				if (chat.oldestUnseenPing) {
					md.focusMessage(chat.oldestUnseenPing);
					chat.oldestUnseenPing = 0;
				}
				notif.updateTab(0, 0);
				$('#input').focus();
			}
		});
	}

});
