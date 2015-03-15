// functions related to wzin conversation effects

miaou(function(wz, skin){

	var	wzins = [],
		frozen;
	
	// highlights the conversation graph on hover of one message
	// The algorithm searches only in normal directions (no replying
	//  to a future message) and guarantees acyclicity
	wz.onmouseenter = function(){
		if (wzins.length) return;
		var colors = skin.wzincolors.conv,
			opts = { zIndex:5, fill:colors[0], scrollable:'#message-scroller' },
			$message = $(this), w,
			ci = -1, // index of the central message among all
			cid = $message.data('message').id;
		if (!cid) return;
		var $messages = $('#messages .message'),
			messages = $messages.map(function(i){ var m=$(this).data('message'); if (m.id===cid) ci=i; return m }).get();
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
		frozen = false;
	}

	wz.onmouseleave = function(){
		if (frozen) return;
		var w;
		while (w=wzins.pop()) w.remove();
	}
	
	wz.updateAll = function(){
		for (var i=0; i<wzins.length; i++) wzins[i].update(); 
	}
	
	$(window).click(function(){
		if (!wzins.length) return;
		frozen = ! frozen;
		wz.onmouseleave();
	});

});
