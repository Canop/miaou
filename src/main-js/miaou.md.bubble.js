
// manage the display of a message in a bubble, and especially in the case
//  of a "bulruk" (displaying when hovering a reply mark
miaou(function(md, chat, gui, locals, roomFinder, skin, time, usr, ws){

	// fetch a message
	// TODO same room only ?
	md.fetchMessageForDiv = function(mid, $c, convCount){
		if (convCount>0) {
			$c.attr('conv-count', convCount);
		}
		$c.addClass("content waiting_for_"+mid)
		ws.emit('get_message', mid);
	}

	if (gui.mobile) return;

	chat.on('incoming_message', function(m){
		let idcls = 'waiting_for_'+m.id;
		let mes = document.getElementsByClassName(idcls);
		if (mes.length) {
			for (me of mes) {
				let $c = $(me);
				md.addUserMessageDiv(m, $c, null, +$c.attr('conv-count'));
				$c.removeClass(idcls);
			}
			// The return false here means there's no addition in the #messages
			// stream. This is a little better as the message would be isolated
			// and would sometimes make the whole page scroll.
			// But it also means the message is fetched every times the mouse
			// hovers the link (a solution for this could be a local cache).
			// This false means we could also not fetch prev and next in
			// libs/ws/get_message
			return false;
		}
	});

	function fillBubbleWithMessage(roomId, messageId, $content){
		$content
		.addClass("room-message-bubble")
		.on('click', ".message", function(){
			md.focusMessage(+$(this).attr('mid'));
		});

		if (+roomId) {
			$room = $("<div class=room-bubble>").appendTo($content);
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
		}
		let $conversation = $("<div class=conversation>").appendTo($content);
		return md.addUserMessageDiv(messageId, $conversation, null, 6);
	}

	$("#messages")
	.bubbleOn('.reply', function($c){ // bulruk
		return fillBubbleWithMessage(0, $(this).attr('to'), $c);
	});
	$("#messages, #notable-messages, #search-results")
	.bubbleOn('.message-bubbler', function($c){
		return fillBubbleWithMessage($(this).attr('roomId'), $(this).attr('mid'), $c);
	});
});
