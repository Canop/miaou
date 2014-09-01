// functions related to users

miaou(function(usr, mod, ed, ws){

	var levels = ['read', 'write', 'admin', 'own'];

	function $user(user){
		return $('#users .user').filter(function(){ return $(this).data('user').id===user.id });
	}

	usr.showUserHoverButtons = function(){
		var user = $(this).data('user');
		if (user.name===me.name) return;
		var decs = $('.decorations', this)
		.append($('<button>').text('ping').click(function(){
			ed.ping(user.name);
		}))
		.append($('<button>').text('pm').click(function(){
			miaou.pmwin = window.open();
			ws.emit('pm', user.id);			
		}));
		if (usr.checkAuth('admin')) {			
			decs.append($('<button>').text('mod').click(function(){
				mod.dialog(user);
			}));
		}
	}
	
	usr.hideUserHoverButtons = function(){
		$('#users .user .decorations button').remove();
	}
	
	usr.insertInUserList = function(user, time) {
		var target, $u = $user(user);
		if (!time) time = Date.now()/1000|0;
		if ($u.length) {
			if (time <= $u.data('time')) return $u;
			$u.detach();
		} else {
			$u = $('<span class=user/>').text(user.name).data('user',user);
			$('<div>').addClass('decorations').appendTo($u);
		}
		$u.data('time', time);
		$('#users .user').each(function(){
			if ($(this).data('time')<=time) {
				target = this;
				return false;
			}
		});
		if (target) $u.insertBefore(target);
		else $('#users').append($u);
		return $u;
	}

	usr.showEntry = function(user){
		usr.insertInUserList(user).addClass('connected');
	}
	usr.showLeave = function(user){
		$user(user).removeClass('connected');		
	}

	// returns true if the user's authorization level in room is at least the passed one
	usr.checkAuth = function(auth) {
		for (var i=levels.length; i--;) {
			if (levels[i]===room.auth) return true;
			if (levels[i]===auth) return false;
		}
		return false;
	}
		
});
