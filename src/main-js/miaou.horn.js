// manages desktop notifications and sounds

miaou(function(horn, gui, locals, md, prefs){

	var sounds = {
		standard: 'ping-standard.wav'
	};
	var audio;

	horn.init = function(){
		if (gui.mobile) {
			horn.show = function(){};
			return;
		}
		if (prefs.get("notif") !== "never" && Notification.permission !== "granted") {
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
					window.location = 'prefs?room='+locals.room.id+'#Notifications';
				});
			});
		}
	}

	horn.honk = function(volume){
		volume = +volume;
		if (!(volume>=0 && volume<=1)) volume = +prefs.get("volume");
		if (!audio) {
			var sound = prefs.get("sound") || sounds.standard;
			audio = new Audio('static/'+sound);
		}
		if (volume) {
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
		if (content && prefs.get("connot")==="yes") {
			dsk.body = content.replace(/^@\w[\w\-]{2,}#\d+/, '');
		}
		var n = new Notification(title, dsk);
		setTimeout(function(){ n.close() }, 15000);
		n.onclick = function(){ window.focus(); n.close(); };
		horn.honk();
	}

});
