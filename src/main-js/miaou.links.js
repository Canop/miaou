miaou(function(links, locals, md, skin){
	
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
	
	function addStop(link){
		$(link).click(function(e){ e.stopPropagation() });
	}
	
	function transformLinksToMiaou($c){
		$c.find('a[href]').each(function(){
			var	parts = this.href.match(/^([^?#]+\/)(\d+)(\?[^#?]*)?#?(\d+)?$/);
			if (parts && parts.length===5 && parts[1]===(location.origin+location.pathname).match(/(.*\/)[^\/]*$/)[1]) {
				// it's an url towards a room or message on this server
				if (locals.room.id===+parts[2]) {
					// it's an url for the same room
					var mid = +parts[4];
					if (mid) {
						// it's an url for a message
						this.href = locals.room.path + '#' + mid
						$(this).click(function(){
							md.focusMessage(mid);
							return false;
						})
						.on('mouseenter', internalLinkWzin.bind(this, mid))
						.on('mouseleave', removeLinkWzin);
					} else {
						$(this).click(function(){
							// it's just an url to our room. Let's scroll to bottom
							gui.scrollToBottom();
							return false;
						})
					}
				} else {
					// it's an url for another room or for a message in another room
					$(this).click(function(){
						location = this.href;
						return false;
					})
					addStop(this);
				}
			} else {
				addStop(this);
			}
		});
	}

	links.init = function(){
		md.registerRenderer(transformLinksToMiaou, true);
	};

	links.permalink = function(message){
		return miaou.root + locals.room.path + '#' + message.id;
	}

});
