// functions related to user profile displaying on hover

miaou(function(prof, gui, locals){
	
	var showTimer;
	
	prof.checkOverProfile = function(e){
		if (!$(document.elementFromPoint(e.pageX, e.pageY)).closest('.profile,.profiled').length) {
			prof.hide();
		}
	}
	
	prof.shownow = function(){
		if ($('.dialog').length) return;
		var $user = $(this).closest('.user'),
			user = $user.data('user') || $user.closest('.notification,.user-messages').data('user'),
			uo = $user.offset(),
			uh = $user.outerHeight(), uw = $user.width(),
			wh = $(window).height();
		var $p = $('<div>').addClass('profile').text('loading profile...'), css={};
		if (uo.top<wh/2) css.top = uo.top;
		else css.bottom = wh-uo.top-uh;
		css.left = uo.left + uw;
		$p.load('publicProfile?user='+user.id+'&room='+locals.room.id);
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

	prof.toggle = function(){
		prof[$('.profile').length ? 'hide' : 'show'].call(this);
	};
});
