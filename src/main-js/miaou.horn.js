// manages desktop notifications and sounds

miaou(function(horn, gui, locals, md){

	var sounds = {
		standard: 'ping-standard.wav'
	};
	var sound = locals.userPrefs ? sounds[locals.userPrefs.sound] || sounds.standard : null,
		audio;

	horn.init = function(){
		if (!locals.userPrefs || /*!window.Notification*/ gui.mobile) {
			// covers two cases :
			// - a page with miaou.min.js but no prefs
			// - a browser without Notification (Chrome/Android)
			horn.show = function(){};
			return;
		}

		if (sound) audio = new Audio('static/'+sound);
		if (locals.userPrefs.notif !== "never" && Notification.permission !== "granted") {
			md.notificationMessage(function($c, close){
				$('<p>').appendTo($c).text(
					"Please grant Miaou the permission to issue desktop notifications"+
					" or change the settings."
				);
				$('<button>').appendTo($c).text('Grant Permission (recommended)').click(function(){
					Notification.requestPermission(function(permission){
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

	horn.honk = function(volume){
		volume = +volume;
		if (!(volume>=0 && volume<=1)) volume = +locals.userPrefs.volume;
		if (audio && volume) {
			audio.volume = +volume;
			audio.play();
		}
	}

	horn.show = function(mid, room, authorname, content){
		mid = mid||0;
		var title = typeof room === "string" ? room : (room || locals.room).name;
		if (mid==localStorage.lastnotif) {
			console.log("avoiding duplicate notif mid=", mid); // yes, also for no id messages
			return;
		} else {
			localStorage.lastnotif = mid;
		}
		if (authorname) title = authorname + ' in ' + title;
		var dsk = {};
		dsk.icon = 'static/M-64.png';
		if (content && locals.userPrefs.connot==="yes") dsk.body = content.replace(/^@\w[\w\-]{2,}#\d+/, '');
		var n = new Notification(title, dsk);
		setTimeout(function(){ n.close() }, 15000);
		n.onclick = function(){ window.focus(); n.close(); };
		horn.honk();
	}

});
