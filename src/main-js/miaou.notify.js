// manages desktop notifications

miaou(function(notif, md){
	
	if (!window.userPrefs || !window.Notification) {
		// covers two cases :
		// - a page with miaou.min.js but no prefs
		// - a browser without Notification (Chrome/Android) 
		notif.show = function(){};
		return;
	}
	
	var sounds = {
		quiet:    'ping-quiet.wav',
		standard: 'ping-standard.wav'
	};
	var sound = userPrefs ? sounds[userPrefs.sound] : null,
		audio;
		
	if (sound) audio = new Audio('static/'+sound);
	if (userPrefs.notif !== "never" && Notification.permission !== "granted") {
		md.notificationMessage(function($c, close){
			$('<p>').appendTo($c).text("Please grant Miaou the permission to issue desktop notifications or change the settings.");
			$('<button>').appendTo($c).text('Grant Permission (recommended)').click(function(){
				Notification.requestPermission(function (permission) {
					if (!('permission' in Notification)) { // from the MDN - not sure if useful
						Notification.permission = permission; 
					}
					setTimeout(gui.scrollToBottom, 100);
				});
				close();
			});
			$('<button>').appendTo($c).text('Change Settings').click(function(){
				window.location = 'prefs?room='+room.id+'#notifs';
			});
		});
	}
	
	notif.show = function(room, authorname, content){
		var n = new Notification(authorname + ' in ' + room.name, {body: content});
		setTimeout(function(){ n.close() }, 15000);
		n.onclick = function() { window.focus(); n.close(); };
		if (audio) {
			audio.play();
		}
	}
});
