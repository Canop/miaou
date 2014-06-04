// "mh" : message history

var miaou = miaou || {};
(function(mh){

	mh.show = function(message){
		var $content = $('<div>').addClass('message-history');
		var current = message;
		for (;;) {
			$('<div>').addClass('item').append(
				$('<span>').addClass('mtime').text(
					current.changed
					? ("edition : " + miaou.md.formatTime(current.changed))
					: ("creation : " + miaou.md.formatTime(current.created))
				)
			).append(
				$('<div>').append(current.content.split('\n').map(function(t){ return $('<div>').text(t) }))
			).prependTo($content);		
			if (!current.previous) break;	
			current = current.previous;
		}
		if (current.changed) {
			$('<span>').addClass('mtime').text("Original version of the message is unknown").prependTo($content);
		}
		miaou.dialog({
			title: "Message History",
			content: $content,
			buttons: {
				OK: null
			}
		});
	}

})(miaou.mh = {});
