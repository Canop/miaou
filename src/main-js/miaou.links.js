miaou(function(links, gui, locals, md, roomFinder, skin){

	var linkwzin;

	function internalLinkWzin(mid){
		var $dest = $('#messages .message[mid='+mid+']');
		if (!$dest.length) return;
		linkwzin = wzin($dest, $(this), {zIndex:5, fill:skin.wzincolors.link, scrollable:'#message-scroller'})
	}

	function removeLinkWzin(){
		if (!linkwzin) return;
		linkwzin.remove();
		linkwzin = null;
	}

	function transformLinksToMiaou($c){
		var server = (location.origin+location.pathname).match(/(.*\/)[^\/]*$/)[1];
		$c.find('a[href]').each(function(){
			var	$link = $(this),
				parts = this.href.match(/^([^?#]+\/)(\d+)(\?[^#?]*)?#?(\d+)?$/);
			console.log('parts:', parts);
			if (parts && parts.length===5 && parts[1]===server) {
				var roomId = +parts[2];
				console.log('roomId:', roomId);
				// it's an url towards a room or message on this server
				if (locals.room && locals.room.id===roomId) {
					// it's an url for the same room
					var mid = +parts[4];
					if (mid) {
						// it's an url for a message
						this.href = locals.room.path + '#' + mid
						$link.click(function(){
							md.focusMessage(mid);
							return false;
						});
						if (!gui.mobile) {
							$link
							.on('mouseenter', internalLinkWzin.bind(this, mid))
							.on('mouseleave', removeLinkWzin);
						}
					} else {
						$link.click(function(){
							// it's just an url to our room. Let's scroll to bottom
							gui.scrollToBottom();
							return false;
						})
					}
				} else {
					// it's an url for another room or for a message in another room
					$link.click(function(e){
						location = this.href;
						return false;
					}).bubbleOn({
						classes: "room-bubble",
						blower:function($c){
							$.get("json/room?id="+roomId, function(data){
								console.log("room data:", data);
								var room = data.room;
								if (!room) {
									$c.text("Unknown Room:" + roomId);
									return;
								}
								roomFinder.$square(room).appendTo($c);
								if (room.private && !room.auth) {
									$("<div class=no-access>")
									.text("You don't have access to this room")
									.appendTo($c);
								}
							});
						}
					});
				}
			} else {
				$link.click(function(e){
					e.stopPropagation();
				});
			}
		});
	}

	links.init = function(){
		md.registerRenderer(transformLinksToMiaou, true);
	};

	links.permalink = function(message){
		return miaou.root + locals.room.path + '#' + message.id;
	}

	// protects against opener attacks (see https://mathiasbynens.github.io/rel-noopener/)
	$(document.body).on("click", "a[target]", function(){
		var w = window.open();
		w.opener = null;
		w.location = this.getAttribute('href');
		return false;
	});

});
