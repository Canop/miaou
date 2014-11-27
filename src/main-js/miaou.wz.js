// functions related to wzin conversation effects

miaou(function(wz){

	var wzins = [];
	
	// highlights the conversation graph on hover of one message
	// The algorithm searches only in normal directions (no replying
	//  to a future message) and guarantees acyclicity
	wz.onmouseenter = function(){
		var colors = ['rgba(139, 69, 19, .2)', 'rgba(42, 18, 234, .15)', 'rgba(180, 237, 228, .4)', 'rgba(192, 169, 244, .25)'],
			opts = { zIndex:5, fill:colors[0], scrollable:'#message-scroller' },
			$message = $(this), w,
			ci = -1, // index of the central message among all
			cid = $message.data('message').id;
		if (!cid) return;
		var $messages = $('#messages .message'),
			messages = $messages.map(function(i){ var m = $(this).data('message'); if (m.id===cid) ci = i; return m }).get();
		while (w=wzins.pop()) w.remove();
		for (var ui=ci, i=ci; i-- && messages[ui].repliesTo;) {
			if (messages[i].id===messages[ui].repliesTo) {
				wzins.push(wzin($messages.eq(ui), $messages.eq(i), opts));
				ui = i;
			}
		}
		opts.fill = undefined;
		(function down(si, colorIndex){
			for (var i=si+1; i<messages.length; i++) {
				if (messages[i].repliesTo && messages[i].repliesTo===messages[si].id) { // be wary of flakes
					wzins.push(wzin($messages.eq(si), $messages.eq(i), $.extend({fill:colors[colorIndex]}, opts)));
					down(i, colorIndex);
					colorIndex = (colorIndex+1)%colors.length;
				}
			}
		})(ci, 0);
	}

	wz.onmouseleave = function(){
		var w;
		while (w=wzins.pop()) w.remove();
	}

});
