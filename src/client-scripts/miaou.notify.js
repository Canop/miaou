// manages desktop notifications
var miaou = miaou || {};
(function(){
	var audio = new Audio('static/119472-ping-loud.wav'),
		levels = ["none", "silent", "loud"],
		labels = ["no ping",,];
		level = localStorage['notification'];
	if (!~levels.indexOf(level)) {
		level = localStorage['notification'] = "none";
	}
	
	$(function(){
		if (!$('body').hasClass('mobile')) { // desktop notifications don't seem to work on mobile
			var $switch = $('<div id=ping>').addClass('radios').appendTo('#prefs');
			$('<span>').addClass('label').text('').appendTo($switch);
			levels.forEach(function(l, i){
				var $r = $('<span>').addClass('radio').text(labels[i]||l).click(function(){
					$(this).addClass('selected').siblings('.radio').removeClass('selected');
					level = localStorage['notification'] = l;
					if (level !== "none" && Notification.permission !== "granted") {
						Notification.requestPermission(function (permission) {
							if (!('permission' in Notification)) { // from the MDN - not sure if useful
								Notification.permission = permission; 
							}
						});
					}
				}).appendTo($switch);
				if (l===level) $r.addClass('selected');
			});
		}
	});
	
	miaou.notify = function(room, authorname, content){
		if (level==="none") return;
		var n = new Notification(authorname + ' in ' + room.name, {body: content});
		setTimeout(function(){ n.close() }, 15000);
		n.onclick = function() { window.focus(); n.close(); };
		if (level==="loud") {
			console.log('loud ping!');
			audio.play();
		}
	}
})();
