// messages and notifications in the chat related to user rights

miaou(function(md, gui, locals, notif, usr, watch, ws){

	md.showRequestAccess = function(ar){
		if (ar.room && ar.room!==locals.room.id) {
			watch.incrRequests(ar.room, 1);
			return;
		}
		if (!ar.user && ar.player) {
			ar.user = {id:ar.player, name:ar.name};
		}
		md.notificationMessage(function($c, close){
			var h = "<span class=user>"+ar.user.name+"</span>";
			if (!ar.answered) {
				h += " requests access to the room.";
			} else if (ar.outcome) {
				h += " has been given "+ar.outcome+" right.";
			} else {
				h += " has been denied entry by <span class=user>"+ar.answerer.name+"</span>.";
			}
			var $p = $('<div>').html(h);
			$c.append($p).dat('user', ar.user);
			$('<button>').text('Check profile').click(function(){
				window.open("user/"+ar.user.name);
			}).appendTo($p);
			if (usr.checkAuth('admin')) {
				$('<button>').text('Manage Users').click(function(){
					location = 'auths?id='+locals.room.id;
					close();
				}).appendTo($p);
				$('<button>').text('Grant Access').click(function(){
					ws.emit('grant_access', {user:ar.user});
					close();
				}).appendTo($p);
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
	md.showGrantAccessDialog = function(grant){ // grant: {user:{id,name}, pingId, pingContent}
		md.notificationMessage(function($c, close){
			var h = "Please confirm you want to invite <span class=user>"+grant.user.name+"</span>";
			var $p = $('<div>').html(h);
			$c.append($p).dat('user', grant.user);
			$('<button>').text('Check profile').click(function(){
				window.open("user/"+grant.user.name);
			}).appendTo($p);
			$('<button>').text('Grant Access').click(function(){
				ws.emit('grant_access', grant);
				close();
			}).appendTo($p);
		});
	}

});
