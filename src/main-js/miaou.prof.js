// functions related to user profile displaying on hover

miaou(function(prof, gui, locals, skin){
	
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
		var	user = $user.data('user') || $user.closest('.notification,.user-messages,.user-line').data('user'),
			uo = $user.offset(),
			uh = $user.outerHeight(), uw = $user.width(),
			wh = $(window).height(),
			mintop = 0, maxbot = wh,
			$ms = gui.$messageScroller;
		if ($ms.length) {
			mintop = $ms.offset().top;
			maxbot = wh-($ms.offset().top+$ms.height());
		}
		var $p = $('<div>').addClass('profile').text('loading profile...'), css={};
		if (uo.top>wh/2) {
			css.bottom = Math.max(wh-uo.top-uh+$(window).scrollTop(), maxbot);
		} else {
			css.top = Math.max(uo.top, mintop);

		}	
		css.left = uo.left + uw;
		$p.load('publicProfile?user='+user.id+'&room='+locals.room.id, function(){
			$p.find('.avatar').css('color', skin.stringToColour(user.name));
			if ($p.offset().top-$(window).scrollTop()+$p.height()>wh) {
				$p.css('bottom', '0').css('top','auto');
			}
		});
		$p.css(css).appendTo('body');
		$user.addClass('profiled');
		$(window).on('mousemove', prof.checkOverProfile);
	};

	// used in chat.jade, chat.mob.jade and auths.jade
	prof.show = function(){
		prof.hide();
		showTimer = setTimeout(prof.shownow.bind(this), miaou.chat.DELAY_BEFORE_PROFILE_POPUP);
	};

	prof.hide = function(){
		clearTimeout(showTimer);
		$('.profile').remove();
		$('.profiled').removeClass('profiled');
		$(window).off('mousemove', prof.checkOverProfile);
	};

	prof.displayed = function(){
		return !!$('.profile').length;
	}

	prof.toggle = function(){
		prof[prof.displayed() ? 'hide' : 'show'].call(this);
	};
});
