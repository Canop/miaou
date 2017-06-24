// "mh" : message history

miaou(function(mh, time){
	mh.show = function(message){
		var $content = $('<div>').addClass('message-history'),
			current = message;
		for (;;) {
			$('<div>').addClass('item').append(
				$('<span>').addClass('mtime').text(
					current.changed
						? ("edition : " + time.formatTime(current.changed))
						: ("creation : " + time.formatTime(current.created))
				)
			).append(
				$('<div>').append(current.content.split('\n').map(function(t){ return $('<div>').text(t) }))
			).prependTo($content);
			if (!current.previous) break;
			current = current.previous;
		}
		if (current.changed) {
			$('<span>').addClass('mtime').text(
				"Message creation : " + time.formatTime(current.created) + ". " +
				"Original content is unknown."
			).prependTo($content);
		}
		miaou.dialog({
			title: "Message History",
			content: $content,
			buttons: {
				OK: null
			}
		});
	}
});
