// manages desktop notifications and sounds

miaou(function(horn, locals, md){

	var sounds = {
		quiet:    'ping-quiet.wav',
		standard: 'ping-standard.wav'
	};
	var sound = locals.userPrefs ? sounds[locals.userPrefs.sound] : null,
		audio;
	
	horn.init = function(){
		if (!locals.userPrefs || !window.Notification) {
			// covers two cases :
			// - a page with miaou.min.js but no prefs
			// - a browser without Notification (Chrome/Android) 
			horn.show = function(){};
			return;
		}		
			
		if (sound) audio = new Audio('static/'+sound);
		if (locals.userPrefs.notif !== "never" && Notification.permission !== "granted") {
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
					window.location = 'prefs?room='+locals.room.id+'#notifs';
				});
			});
		}
	}
	
	horn.show = function(mid, room, authorname, content){
		mid = mid||0;
		var title = typeof room === "string" ? room : (room || locals.room).name;
		if (mid==localStorage.lastnotif) {
			console.log("avoiding duplicate notif mid=",mid); // yes, also for no id messages
			return;
		} else {
			localStorage.lastnotif = mid;
		}
		if (authorname) title = authorname + ' in ' + title;
		var n = new Notification(title, {body: content||''});
		setTimeout(function(){ n.close() }, 15000);
		n.onclick = function() { window.focus(); n.close(); };
		if (audio) {
			audio.play();
		}
	}
	
});
