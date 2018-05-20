// functions related to user profile displaying on hover

miaou(function(prof, chat, ed, gui, locals, skin, ws){

	var showTimer;

	prof.checkOverProfile = function(e){
		var elems = $('.profile,.profiled,.profiler').get();
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

	function joinDivs($1, $2, cl){
		$("."+cl).remove();
		var	o1 = $1[0].getBoundingClientRect(),
			o2 = $2[0].getBoundingClientRect(),
			top = Math.max(o1.top, o2.top),
			bottom = Math.min(o1.top+o1.height, o2.top+o2.height);
		$('<div class="'+cl+'">').appendTo(document.body).css({
			position: "fixed",
			left: o2.left-1,
			top: top,
			width: 2,
			height: bottom - top - 2, // -2: bad hack to account for borders
			zIndex: 32
		});
	}

	prof.showNow = function(){
		if ($('.dialog').length) return;
		var $user = $(this).closest('.user');
		if (!$user.length) $user = $(this).closest('.user-messages').find('.user');
		if (!$user.length) {
			console.log("no $user", this);
			return; // happens when we leave a removed message decoration
		}
		var	user = $user.dat('user') || $user.closest('.notification,.user-messages,.user-line').dat('user'),
			isInMessages = !!$user.closest("#messages").length,
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
			css.left = uo.left + uw + (isInMessages ? 6 : 0);
			$user.addClass('profiled');
			$p.css(css).appendTo('body').text('loading profile...').load(url, function(){
				$p.find('.avatar').css('color', skin.stringToColour(user.name));
				if ($p.offset().top-$(window).scrollTop()+$p.height()>wh) {
					$p.css('bottom', '0').css('top', 'auto');
				}
				joinDivs($user, $p, "profile-join");
			});
			joinDivs($user, $p, "profile-join");
		}
	}

	// used in chat.jade, chat.mob.jade and auths.jade
	prof.show = function(){
		var $user = $(this).closest('.user');
		if (!$user.length) $user = $(this).closest(".user-messages").children(".user");
		if ($user.hasClass("profiler")) return;
		prof.hide();
		showTimer = setTimeout(prof.showNow.bind(this), miaou.chat.DELAY_BEFORE_PROFILE_POPUP);
		$user.addClass("profiler");
		$(window).on('mousemove', prof.checkOverProfile);
	}

	prof.hide = function(){
		clearTimeout(showTimer);
		$('.profile, .profile-page, .profile-join').remove();
		$('.profiled').removeClass('profiled');
		$('.profiler').removeClass('profiler');
		$(window).off('mousemove', prof.checkOverProfile);
	}

	prof.displayed = function(){
		return !!$('.profile').length;
	}

	prof.toggle = function(){
		prof[prof.displayed() ? 'hide' : 'show'].call(this);
	}

	$("#message-scroller").on("scroll", prof.hide);
});
