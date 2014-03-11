// functions related to user profile displaying on hover
var miaou = miaou || {};

miaou.eventIsOver = function(event, o) {
	if (!o.length) return false;
	var pos = o.offset(), ex = event.pageX, ey = event.pageY;
	return (
		ex>=pos.left
		&& ex<=pos.left+o.width()
		&& ey>=pos.top
		&& ey<pos.top+o.height()
	);
}

miaou.userProfile = {
	// used in chat.jade, chat.mob.jade and auths.jade
	show: function(){
		miaou.userProfile.hide();
		miaou.profileTimer = setTimeout((function(){
			var $user = $(this), $message = $user.closest('.message,.notification,.userLine'),
				up = ($message.length ? $message : $user).position(),
				uh = $user.height(), uw = $user.width(),
				$scroller = $user.closest('#messagescroller,#authspage,#left'), ss = $scroller.scrollTop(), sh = $scroller.height(),
				$container = $user.closest('#messages,#authspage,body').first(), ch = $container.height();
			var $p = $('<div>').addClass('profile').text('loading profile...'), css={};
			if (up.top-ss<sh/2) css.top = up.top+1;
			else css.bottom = ch-up.top-uh-3;
			css.left = up.left + uw;
			if (!$message.hasClass('message')) {
				css.left += 10; css.bottom -= 12; // :-(
			}
			$p.css(css).appendTo($container);
			$user.addClass('profiled');
			var userId, data;
			if ((data = $user.data('user') || (data = $message.data('user')))) userId = data.id;
			else userId = $message.data('message').author;
			$p.load('publicProfile?user='+userId+'&room='+room.id);
		}).bind(this), miaou.chat.DELAY_BEFORE_PROFILE_POPUP);
	},
	hide: function(){
		clearTimeout(miaou.profileTimer);
		$('.profile').remove();
		$('.user').removeClass('profiled');
	},
	toggle: function(){
		miaou[$('.profile').length ? 'hideUserProfile' : 'showUserProfile'].call(this);
	}
}
