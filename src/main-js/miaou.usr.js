// functions related to users

miaou(function(usr, chat, ed, locals, mod, time, ws){

	var	levels = ['read', 'write', 'admin', 'own'],
		recentUsers = []; // sorted list of {id,name,mc} (this list isn't displayed but used for ping autocompletion)

	// o is an object with avs and avk (may be a user or a message)
	usr.avatarsrc = function(o){
		if (!o.avk) return;
		if (/^https?:\/\//.test(o.avk)) return o.avk; // this is hacky...
		if (o.avs==="gravatar") { // because avatars.io redirects https to http, I try to avoid it
			return "https://www.gravatar.com/avatar/"+o.avk+"?s=200";
		}
		return 'https://avatars.io/'+o.avs+'/'+o.avk+'?size=large';
	}

	// if the room is a dialog room and we guess the name of the other user, return this name
	usr.interlocutor = function(w){
		if (!w.dialog) return;
		var names = w.name.match(/^([a-zA-Z][\w\-]{2,19}) & ([a-zA-Z][\w\-]{2,19})$/);
		if (!names) return;
		if (names[1]===locals.me.name) return names[2];
		if (names[2]===locals.me.name) return names[1];
	}

	function $user(user){
		let $usr = $('#users .user').filter(function(){
			return $(this).dat('user').id===user.id
		});
		if (user.created > Date.now()/1000 - 2*24*60*60) {
			console.log("NEW USER:", user);
			$("<div class=new-user-mark>New</div>").appendTo($usr);
			//$usr.addClass("new-user");
		}
		return $usr;
	}

	usr.showUserHoverButtons = function(){
		var user = $(this).dat('user');
		if (user.name===locals.me.name) return;
		var decs = $('.decorations', this)
		.append($('<button>').text('ping').click(function(){
			ed.ping(user.name);
		}))
		.append($('<button>').text('pm').click(function(){
			ws.emit('pm', user.id);
		}));
		if (usr.checkAuth('admin')) {
			decs.append($('<button>').text('mod').click(function(){
				mod.dialog(user);
			}));
		}
	}

	usr.pick = function(userId){
		for (user of recentUsers) {
			if (user.id==userId) return user;
		}
	}

	usr.recentNamesStartingWith = function(s){
		return recentUsers.filter(function(u){
			return !u.name.lastIndexOf(s, 0)
		}).map(function(u){
			return u.name
		});
	}

	usr.hideUserHoverButtons = function(){
		$('#users .user .decorations button').remove();
	}

	usr.insert = function(user, time){
		usr.insertInUserList(user, time);
		usr.insertAmongRecentUsers(user, time);
	}

	usr.nbRecentUsers = function(){
		return recentUsers.length;
	}

	usr.insertAmongRecentUsers = function(user, enterTime){
		var i;
		user.mc = enterTime;
		for (i=0; i<recentUsers.length; i++) {
			if (recentUsers[i].id===user.id) {
				recentUsers.splice(i, 1);
				break;
			}
		}
		for (i=0; i<recentUsers.length; i++) {
			if (enterTime>recentUsers[i].mc) {
				recentUsers.splice(i, 0, user);
				return;
			}
		}
		recentUsers.push(user);
	}

	usr.insertInUserList = function(user, enterTime){
		var target, $u = $user(user);
		if (!enterTime) enterTime = time.now();
		if ($u.length) {
			if (enterTime <= $u.dat('time')) return $u;
			$u.detach();
		} else {
			$u = $('<div>').addClass('user').dat('user', user);
			$('<span>').text(user.name).appendTo($u);
			$('<div>').addClass('decorations').appendTo($u);
		}
		$u.dat('time', enterTime);
		$('#users .user').each(function(){
			if ($(this).dat('time')<=enterTime) {
				target = this;
				return false;
			}
		});
		if (target) {
			$u.insertBefore(target).hide().fadeIn();
		} else {
			$('#users').append($u);
		}
		return $u;
	}

	usr.showEntry = function(user){
		usr.insertInUserList(user).addClass('connected');
		chat.trigger("incoming_user", user);
	}
	usr.showLeave = function(user){
		$user(user).removeClass('connected');
		chat.trigger("leaving_user", user);
	}

	// returns true if the user's authorization level in room is at least the passed one
	usr.checkAuth = function(auth){
		for (var i=levels.length; i--;) {
			if (levels[i]===locals.room.auth) return true;
			if (levels[i]===auth) return false;
		}
		return false;
	}
});
