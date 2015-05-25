// notification of ws connections or reconnections
miaou(function(ws, md){
	
	var notif;

	function onOff(){
		console.log('DISCONNECT');
		if (notif) return;
		notif = md.notificationMessage(function($con, close){
			$con
			.append(
				$('<span>').text("Connection to the server lost.")
			)
			.append(
				$('<button id=ws-off-refresh-button>').text('Refresh')
				.click(function(){ location.reload() })
			)
		}).remove(function(){ notif = null });
	}
	
	function onOn(){
		console.log('RECONNECT');
		if (notif) notif.remove();	
	}

	ws.notif = {onOff:onOff, onOn:onOn};
});
