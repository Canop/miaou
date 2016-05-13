miaou(function(locals){
	if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|Mini/i.test(navigator.userAgent)) {
		$(document.body).addClass('mobile');
	}

	var	room = locals.room,
		socket = window.io.connect(location.origin);

	socket.on('connect', function(){
		socket.emit('pre_request', { room:room.id });
	}).on('request_denied', function(){
		$('#response').text('refused');
	}).on('request_accepted', function(){
		$('#response').text('accepted');
	}).on('request_outcome', function(outcome){
		if (outcome.granted) {
			location = room.id;
		} else {
			var t = "You have been denied access to the room";
			if (outcome.message) {
				t += ' with this message:';
				$('#denyMessage').html(miaou.fmt.mdTextToHtml(outcome.message));
			}
			$('#response').css('color', 'red').text(t);
		}
	});

	$('.rendered').html(function(_, h){ return miaou.fmt.mdTextToHtml(h) });
	$('#cancel').click(function(){ location="rooms" });
	$('#request').click(function(){
		socket.emit('request', {room:room.id, message:$('#request_speech').val() });
		$('#request_speech').replaceWith($('<div>').addClass('rendered')
		.html(miaou.fmt.mdTextToHtml($('#request_speech').val())));
		$('#cancel').hide();
		$('#response').text(
			"Your request is visible to the admins of the room. Don't close this window : "+
			"You'll automaticaly enter the room as soon as one of them accepts it.");
		$(this).hide();
	});
});
