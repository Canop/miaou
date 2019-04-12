miaou(function(links, gui, locals, md, roomFinder, skin, usr){

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

	links.transformLinks = function($c){
		let server = (location.origin+location.pathname).match(/(.*\/)[^\/]*$/)[1];
		$c.find('a[href]').each(function(){
			let $link = $(this);
			// Is it a link to an image ?
			if (/\.(svg|png|gif|jpeg?)($|\?)/i.test(this.href)) {
				$link.bubbleOn($c=>{
					$("<img>").attr("src", this.href).appendTo($c);
				});
				return;
			}
			// Is it a link to a Miaou user page on the same server ?
			let parts = this.href.match(/^([^?#]+\/)user\/(\w+)$/);
			if (parts && parts[1]===server) {
				$link.bubbleOn(function($c){
					$.getJSON(
						`${server}json/user?user=${parts[2]}`,
						function(user){
							$c.addClass("miaou-user");
							let img = usr.avatarsrc(user);
							if (img) $("<img>").attr("src", img).appendTo($c);
							if (user.name) $("<h2>").text(user.name).appendTo($c);
							$("<i>").text("a Miaou user").appendTo($c);
						}
					);
				});
				return;
			}
			// Is it a link to a room or message on the same server ?
			parts = this.href.match(/^([^?#]+\/)(\d+)(\?[^#?]*)?#?(\d+)?$/);
			if (parts && parts.length===5 && parts[1]===server) {
				// it's an url towards a room or message on this server
				let roomId = +parts[2];
				let mid = +parts[4];
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
				return;
			}
			// It's just a standard "external" linl
			$link.addClass("external-link").click(function(e){
				e.stopPropagation();
			});
		});
	}

	links.init = function(){
		md.registerRenderer(links.transformLinks, true);
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
