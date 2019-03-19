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

	links.transformLinksToMiaou = function($c){
		var server = (location.origin+location.pathname).match(/(.*\/)[^\/]*$/)[1];
		$c.find('a[href]').each(function(){
			var	$link = $(this),
				parts = this.href.match(/^([^?#]+\/)(\d+)(\?[^#?]*)?#?(\d+)?$/);
			if (parts && parts.length===5 && parts[1]===server) {
				let roomId = +parts[2];
				let mid = +parts[4];
				// it's an url towards a room or message on this server
				if (locals.room && locals.room.id===roomId) {
					// it's an url for the same room
					if (mid) {
						// it's an url for a message
						this.href = locals.room.path + '#' + mid
						$link.click(function(){
							md.focusMessage(mid);
							return false;
						});
						if (!gui.mobile) {
							$link
							.addClass("message-bubbler").attr("mid", mid) // for bubbling
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
						if (gui.currentDownKey==17) { // ctrl
							return;
						}
						location = this.href;
						return false;
					})
					.addClass('message-bubbler').attr('roomId', roomId).attr('mid', mid);
				}
			} else {
				$link.click(function(e){
					e.stopPropagation();
				});
			}
		});
	}

	links.init = function(){
		md.registerRenderer(links.transformLinksToMiaou, true);
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
