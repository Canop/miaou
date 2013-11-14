var miaou = miaou || {};
(function(){
	miaou.wantNotifs = localStorage['wantNotifs']==="true" || false; // TODO set on a per room basis
	
	$(function(){
		$pref = $('<span class=pref>');
		$pref.append(
			$('<input id=pref_notif type=checkbox>').prop('checked', miaou.wantNotifs).change(function(){
				localStorage['wantNotifs'] = miaou.wantNotifs = this.checked;
				if (miaou.wantNotifs && Notification.permission !== "granted") {
					Notification.requestPermission(function (permission) {
						if (!('permission' in Notification)) { // from the MDN - not sure if useful
							Notification.permission = permission; 
						}
						console.log('User set permission to ', permission);
					});
				}
			})
		).append(
			$('<label for=pref_notif>').text("Be notified on ping")
		).appendTo('#prefs');
	});
	
	miaou.notify = function(room, user, content){
		if (!miaou.wantNotifs) return;
		var n = new Notification(user.name + ' in ' + room, {body: content});
		setTimeout(function(){ n.close() }, 15000);
		n.onclick = function() { window.focus(); n.close(); };
	}
})();
