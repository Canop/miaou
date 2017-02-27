// functions related to user profile displaying on hover

miaou(function(prof, chat, ed, gui, locals, skin, ws){

	var showTimer;

	prof.checkOverProfile = function(e){
		var elems = $('.profile,.profiled').get();
		for (var i=0; i<elems.length; i++) {
			var $o = $(elems[i]), off = $o.offset();
			if (
				e.pageX>=off.left && e.pageX<=off.left+$o.outerWidth()
				&& e.pageY>=off.top && e.pageY<=off.top+$o.outerHeight()
			) {
				return;
			}
		}
		prof.hide();
	}

	prof.shownow = function(){
		if ($('.dialog').length) return;
		var $user = $(this).closest('.user');
		if (!$user.length) $user = $(this).closest('.user-messages').find('.user');
		var	user = $user.dat('user') || $user.closest('.notification,.user-messages,.user-line').dat('user'),
			$p = $('<div>').addClass('profile'),
			url = 'publicProfile?user='+user.id+'&room='+locals.room.id;
		if (gui.mobile) {
			var	$page = $("<div>").addClass("profile-page").appendTo("body"),
				$buttons = $("<div class=profile-buttons>").appendTo($page);
			$("<button>").text("back").appendTo($buttons).click(prof.hide);
			if (user.id !== locals.me.id) {
				$("<button>").text("ping").appendTo($buttons).click(function(){
					prof.hide();
					ed.ping(user.name);
					// the following functions are defined in pad.mob.js
					chat.closeAllTabs();
					chat.tabs.write.open();
				});
				if (!user.bot) {
					$("<button>").text("pm").appendTo($buttons).click(function(){
						ws.emit('pm', user.id);
						chat.closeAllTabs();
					});
				}
			} else {
				$("<i>").text("that's you").appendTo($buttons);
			}
			$p.text('loading profile...').load(url).appendTo($page);
		} else {
			var	uo = $user.offset(),
				uh = $user.outerHeight(), uw = $user.width(),
				wh = $(window).height(),
				mintop = 0, maxbot = wh,
				$ms = gui.$messageScroller,
				css={};
			if ($ms.length) {
				mintop = $ms.offset().top;
				maxbot = wh-($ms.offset().top+$ms.height());
			}
			if (uo.top>wh/2) {
				css.bottom = Math.max(wh-uo.top-uh+$(window).scrollTop(), maxbot);
			} else {
				css.top = Math.max(uo.top, mintop);

			}
			css.left = uo.left + uw;
			$user.addClass('profiled');
			$p.css(css).appendTo('body').text('loading profile...').load(url, function(){
				$p.find('.avatar').css('color', skin.stringToColour(user.name));
				if ($p.offset().top-$(window).scrollTop()+$p.height()>wh) {
					$p.css('bottom', '0').css('top', 'auto');
				}
			});
			$(window).on('mousemove', prof.checkOverProfile);
		}
	}

	// used in chat.jade, chat.mob.jade and auths.jade
	prof.show = function(){
		prof.hide();
		showTimer = setTimeout(prof.shownow.bind(this), miaou.chat.DELAY_BEFORE_PROFILE_POPUP);
	}

	prof.hide = function(){
		clearTimeout(showTimer);
		$('.profile, .profile-page').remove();
		$('.profiled').removeClass('profiled');
		$(window).off('mousemove', prof.checkOverProfile);
	}

	prof.displayed = function(){
		return !!$('.profile').length;
	}

	prof.toggle = function(){
		prof[prof.displayed() ? 'hide' : 'show'].call(this);
	}
});
