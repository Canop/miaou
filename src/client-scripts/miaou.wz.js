// functions related to wzin reply effects

var miaou = miaou || {};

(function(wz){

	var wzins = [];
	
	// highlights the conversation graph on hover of one message
	// The algorithm searches only in normal directions (no replying
	//  to a future message) and guarantees acyclicity
	wz.onmouseenter = function(){
		var $message = $(this),
			w,
			opts = { zIndex:40, fill:'rgba(139, 69, 19, .2)', scrollables:'#messagescroller', parent:document.getElementById('messagescroller') },
			ci = -1, // index of the central message among all
			cid = $message.data('message').id,
			$messages = $('#messages .message'),
			messages = $messages.map(function(i){ var m = $(this).data('message'); if (m.id===cid) ci = i; return m }).get();
		while (w=wzins.pop()) w.remove();
		for (var ui=ci, i=ci; i-->0 && messages[ui].repliesTo;) {
			if (messages[i].id===messages[ui].repliesTo){
				wzins.push(wzin($messages.eq(ui), $messages.eq(i), opts));
				ui = i;
			}
		}
		(function down(si){
			for (var i=si+1; i<messages.length; i++) {
				if (messages[i].repliesTo===messages[si].id){
					wzins.push(wzin($messages.eq(si), $messages.eq(i), opts));
					return down(i);
				}
			}
		})(ci);
	}

	wz.onmouseleave = function(){
		var w;
		while (w=wzins.pop()) w.remove();
	}

})(miaou.wz = {});
