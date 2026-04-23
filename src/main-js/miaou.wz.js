// functions related to wzin conversation effects

miaou(function(wz, gui, skin){

	if (gui.mobile) return;

	let	wzins = [],
		frozen;

	// highlights the conversation graph on hover of one message
	// The algorithm searches only in normal directions (no replying
	//  to a future message) and guarantees acyclicity
	wz.onmouseenter = function(){
		if (wzins.length) return;
		let	colors = skin.wzincolors.conv,
			opts = { zIndex:5, fill:colors[0], scrollable:gui.$messageScroller },
			$message = $(this), w,
			ci = -1, // index of the central message among all
			cid = $message.dat('message').id;
		if (!cid) return;
		let $messages = $('#messages .message');
		let messages = $messages.map(function(i){
			let m=$(this).dat('message');
			if (m.id===cid) ci=i;
			return m
		}).get();
		while ((w=wzins.pop())) w.remove();
		for (let ui=ci, i=ci; i-- && messages[ui].repliesTo;) {
			if (messages[i].id===messages[ui].repliesTo) {
				let self = messages[i].author===messages[ui].author;
				wzins.push(wzin(
					$messages.eq(ui),
					$messages.eq(i),
					$.extend({
						side: self ? "right" : "left",
					}, opts)

				));
				ui = i;
			}
		}
		opts.fill = undefined;
		(function down(si, colorIndex){
			for (let i=si+1; i<messages.length; i++) {
				if (messages[i].repliesTo && messages[i].repliesTo===messages[si].id) { // be wary of flakes
					let self = messages[i].author===messages[si].author;
					wzins.push(wzin(
						$messages.eq(si),
						$messages.eq(i),
						$.extend({
							fill: colors[colorIndex],
							side: self ? "right" : "left",
						}, opts)
					));
					down(i, colorIndex);
					colorIndex = (colorIndex+1)%colors.length;
				}
			}
		})(ci, 0);
		frozen = false;
	}

	wz.onmouseleave = function(){
		if (frozen) return;
		let w;
		while ((w=wzins.pop())) w.remove();
	}

	wz.updateAll = function(){
		for (let i=0; i<wzins.length; i++) wzins[i].update();
	}

	$(window).click(function(){
		if (!wzins.length) return;
		frozen = ! frozen;
		wz.onmouseleave();
	});

});
