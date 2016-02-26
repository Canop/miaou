// notification of ws connections or reconnections
miaou(function(ws, md){

	var	notif,
		timer;

	function onOff(){
		console.log('DISCONNECT');
		if (notif || timer) return;
		timer = setTimeout(function(){
			notif = md.notificationMessage(function($con, close){
				$con
				.append(
					$('<span>').text("Connection to the server lost.")
				)
				.append(
					$('<button id=ws-off-refresh-button>')
					.text('Try Refreshing')
					.click(function(){
						location.reload()
					})
				)
			}).remove(function(){ notif = null });
		}, 18000);
	}

	function onOn(){
		console.log('RECONNECT');
		clearTimeout(timer);
		timer = 0;
		if (notif) notif.remove();
	}

	ws.notif = {onOff:onOff, onOn:onOn};
});
