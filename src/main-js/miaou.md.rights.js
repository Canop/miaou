// messages and notifications in the chat related to user rights

miaou(function(md, gui, notif, usr, ws){

	md.showRequestAccess = function(ar){
		md.notificationMessage(function($c, close){
			var h;
			if (!ar.answered) h = "<span class=user>"+ar.user.name+"</span> requests access to the room.";
			else if (ar.outcome) h = "<span class=user>"+ar.user.name+"</span> has been given "+ar.outcome+" right.";
			else h = "<span class=user>"+ar.user.name+"</span> has been denied entry by <span class=user>"+ar.answerer.name+"</span>.";
			var $p = $('<div>').html(h);
			$c.append($p).data('user', ar.user);
			if (usr.checkAuth('admin')) {
				$('<button>').text('Manage Users').click(function(){ $('#auths').click(); close(); }).appendTo($p);
				$('<button>').text('Grant Access').click(function(){ ws.emit('grant_access', ar.user.id); close(); }).appendTo($p);
				notif.touch();
			}
			if (ar.request_message) {
				$('<div>').addClass('access_request').append(
					$('<div>').addClass('user').text(ar.user.name)
				).append(
					$('<div>').addClass('content').append(miaou.fmt.mdTextToHtml(ar.request_message))
				).appendTo($p);
			}
		});
	}

	// if this is called, me is supposed to be an admin of the room
	md.showGrantAccessDialog = function(user){
		md.notificationMessage(function($c, close){
			var h = "Please confirm you want to invite <span class=user>"+user.name+"</span> (you may check his profile by hovering his name).";
			var $p = $('<div>').html(h);
			$c.append($p).data('user', user);
			$('<button>').text('Grant Access').click(function(){ ws.emit('grant_access', user.id); close(); }).appendTo($p);
		});
	}

});
