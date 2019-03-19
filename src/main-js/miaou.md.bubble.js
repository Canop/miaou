
// manage the display of a message in a bubble, and especially in the case
//  of a "bulruk" (displaying when hovering a reply mark
miaou(function(md, chat, gui, locals, roomFinder, skin, time, usr, ws){

	// fetch a message
	// TODO same room only ?
	md.fetchMessageForDiv = function(mid, $c){
		$c.addClass("content waiting_for_"+mid)
		ws.emit('get_message', mid);
	}

	if (gui.mobile) return;

	chat.on('incoming_message', function(m){
		let idcls = 'waiting_for_'+m.id;
		let mes = document.getElementsByClassName(idcls);
		for (me of mes) {
			let $c = $(me);
			md.addUserMessageDiv(m, $c);
			$c.removeClass(idcls);
		}
	});

	function fillBubbleWithMessage(roomId, messageId, $c){
		$c.addClass("room-message-bubble");
		let $existingMessage = $("#messages .message[mid="+messageId+"]");
		if (+roomId) {
			$room = $("<div class=room-bubble>").appendTo($c);
			$.get("json/room?id="+roomId, function(data){
				var room = data.room;
				if (!room) {
					$r.text("Unknown Room:" + roomId);
					return;
				}
				roomFinder.$square(room).appendTo($room);
				if (!room.private || room.auth) return;
				$("<div class=no-access>")
				.text("You don't have access to this room")
				.appendTo($room);
			});
			$message = $("<div class=message-bubble>").appendTo($c);
			$c = $message;
		}
		if (+messageId) {
			if ($existingMessage.length) {
				var mtop = $existingMessage.offset().top;
				if (mtop>0) return false; // message is visible, no need for the bulruk
				md.addUserMessageDiv($existingMessage.dat('message'), $c);
			} else {
				md.fetchMessageForDiv(messageId, $c);
			}
		}
	}

	$("#messages")
	.bubbleOn('.reply', function($c){ // bulruk
		return fillBubbleWithMessage(0, $(this).attr('to'), $c);
	})
	.bubbleOn('.message-bubbler', function($c){
		return fillBubbleWithMessage($(this).attr('roomId'), $(this).attr('mid'), $c);
	});
});
