var miaou = miaou || {};
(function(){
	var NB_MESSAGES = 100,
		MAX_AGE_FOR_EDIT = 1800, // seconds (should be coherent with server settings) 
		DISRUPTION_THRESHOLD = 60*60, // seconds
		nbUnseenMessages = 0, nbUnseenPings = 0,
		users = [],
		messages = [],
		lastReceivedPing = 0, // seconds since epoch, server time
		enterTime; // seconds since epoch, server time
	
	function setEnterTime(serverTime){
		enterTime = serverTime;
	}
	
	// returns true if the user's authorization level in room is at least the passed one
	function checkAuth(auth) {
		var levels = ['read', 'write', 'admin', 'own'];
		for (var i=levels.length; i-->0;) {
			if (levels[i]===room.auth) return true;
            if (levels[i]===auth) return false;
		}
        return false;
	}

	function pingRegex(name) {
		return new RegExp('@'+name+'(\\b|$)')
	}

	function scrollToBottom(){
		$('#messages').scrollTop($('#messages')[0].scrollHeight)
	}

	function showMessageFlowDisruptions(){
		$('.message').removeClass('disrupt').filter(function(i){
			// we're assuming here that the elements are coherent with the messages array
			return (i>0 && messages[i].created-messages[i-1].created > DISRUPTION_THRESHOLD);
		}).addClass('disrupt');
	}

	function makeMessageDiv(message){
		var $content = $('<div>').addClass('content').append(miaou.mdToHtml(message.content));
		var $md = $('<div>').addClass('message').append(
			$('<div>').addClass('user').text(message.authorname)
		).append($content).data('message', message).attr('mid', message.id);
		if (message.authorname===me.name) $md.addClass('me');
		if ($content.height()>150) {
			$content.addClass("closed");
			$md.append('<div class=opener>');
		}
		$content.find('img').load(scrollToBottom);
		if (message.changed) $md.addClass('edited');
		return $md;
	}

	function addMessage(message){
		var insertionIndex = messages.length; // -1 : insert at end, i>=0 : insert before i
		if (messages.length===0 || message.id>messages[messages.length-1].id) {
			insertionIndex = -1;
		} else if (messages[0].id>message.id) {
			insertionIndex = 0;
		} else {
			while (messages[--insertionIndex].id>message.id);
		}
		var $md = makeMessageDiv(message);
		if (~insertionIndex) {
			if (messages[insertionIndex].id===message.id) {
				messages[insertionIndex] = message;
				$('#messages .message').eq(insertionIndex).replaceWith($md);				
			} else {
				messages.splice(insertionIndex, 0, message);
				$('#messages .message').eq(insertionIndex).before($md);				
			}
		} else {
			messages.push(message);
			$md.appendTo('#messages');
			addToUserList({id: message.author, name: message.authorname});
		}
		showMessageFlowDisruptions();
		scrollToBottom();
	}
	
	function showError(error){
		console.log('ERROR', error);
		var $md = $('<div>').addClass('error').append(
			$('<div>').addClass('user error').text("Miaou Server")
		).append(error).appendTo('#messages');
		scrollToBottom();
	}
	
	function showRequestAccess(ar){
		var h;
		if (!ar.answered) h = "<span class=user>"+ar.user.name+"</span> requests access to the room";
		else if (ar.outcome) h = "<span class=user>"+ar.user.name+"</span> has been given "+ar.outcome+" right";
		else h = "<span class=user>"+ar.user.name+"</span> has been denied entry by <span class=user>"+ar.answerer.name+"</span>";
		var $md = $('<div>').html(h).addClass('notification').appendTo('#messages');
		if (checkAuth('admin')) {
			$('<button>').text('Manage Users').click(function(){ $('#auths').click() }).appendTo($md);
			if (!vis()) {
				document.title = (nbUnseenPings?'*':'') + ++nbUnseenMessages + ' - ' + room.name;				
			}
		}
		scrollToBottom();
	}
	
	function updateUserList(user, keep){
		for (var i=0; i<users.length; i++) {
			if (users[i].name===user.name) {
				users.splice(i,1);
				break;
			}
		}
		if (keep) users.push(user);
		$('#users').html(users.map(function(u){ return '<span class=user>'+u.name+'</span>' }).reverse().join(''));
	}
	function addToUserList(user){
		updateUserList(user, true);
	}
	
	$(function(){
		var socket = io.connect(location.origin);

		function clearPings() {
			// clear the pings of the current room and ask for the ones of the other rooms
			socket.emit('clear_pings', lastReceivedPing, function(pings){
				if (pings.length) {
					pings.forEach(function(p){ lastReceivedPing = Math.max(lastReceivedPing, p.last) });
					var h = "You've been pinged in room", links = pings.map(function(p){ return '<a target=room_'+p.room+' href='+p.room+'>'+p.roomname+'</a>' });
					if (pings.length==1) h += ' '+links[0];
					else h += 's '+links.slice(0,-1).join(', ')+' and '+links.pop();
					$('<div>').html(h).addClass('notification').appendTo('#messages');
					scrollToBottom();
				}
			});
		}

		vis(function(){
			if (vis()) {
				clearPings();
				nbUnseenMessages = 0; nbUnseenPings = 0;
				document.title = room ? room.name : 'no room';
			}
		});

		setInterval(function(){
			if (vis()) clearPings();
		}, 5*60*1000);

		socket.on('connect', function(){
			socket.emit('enter', room.id, setEnterTime);
		}).on('get_room', function(unhandledMessage){
			console.log('Server asks room');
			socket.emit('enter', room.id, setEnterTime);
			socket.emit('message', unhandledMessage);
		}).on('message', function(message){
			addMessage(message);
			if (message.created>enterTime) {
				var visible = vis(), ping = pingRegex(me.name).test(message.content);
				if (ping) {
					if (visible) {
						clearPings();
					} else {
						miaou.notify(room, message.authorname, message.content);
						nbUnseenPings++;
					}
				}
				if (!visible) document.title = (nbUnseenPings?'*':'') + ++nbUnseenMessages + ' - ' + room.name;
			}
		}).on('room', function(r){
			if (room.id!==r.id) {
				console.log('SHOULD NOT HAPPEN!');
			}
			room = r;
			localStorage['successfulLoginLastTime'] = "yes";
			localStorage['room'] = room.id;
			document.title = room.name;
			$('#roomname').text('Room : ' + room.name);
			$('#roomdescription').html(miaou.mdToHtml(room.description));
		}).on('request', function(ar){
			showRequestAccess(ar);
		}).on('reconnect', function(){
			console.log('RECONNECT, sending room again');
			setTimeout(function(){
				socket.emit('enter', room.id, setEnterTime);
			}, 500); // first message after reconnect not always received by server if I don't delay it (todo : elucidate and clean)
		}).on('disconnect', function(){
			console.log('DISCONNECT');
		}).on('enter', addToUserList).on('leave', updateUserList).on('error', showError);
		
		$('#messages').on('click', '.message .content img', function(){ window.open(this.src) })
		.on('click', '.opener', function(){
			$(this).removeClass('opener').addClass('closer').closest('.message').find('.content').removeClass('closed');
		}).on('click', '.closer', function(){
			$(this).removeClass('closer').addClass('opener').closest('.message').find('.content').addClass('closed');					
		}).on('mouseenter', '.message', function(){
			var message = $(this).data('message'), menuItems = [];
			if ($(this).hasClass('me')) menuItems.push(Date.now()/1000 - message.created < MAX_AGE_FOR_EDIT ? 'click to edit' : 'too old for edition');
			menuItems.push(moment(message.created*1000).fromNow());
			if (message.changed) menuItems.push('edited ' + moment(message.changed*1000).fromNow());
			$('<div>').addClass('messageinfo').html(menuItems.join(' - ')).appendTo(this);
		}).on('mouseleave', '.message', function(){
			$('.messageinfo').remove();
		}).on('click', 'a', function(e){
			e.stopPropagation();
		}).on('click', '.message.me', function(){
			var message = $(this).data('message');
			if (Date.now()/1000 - message.created < MAX_AGE_FOR_EDIT) $('#input').editMessage(message);
		});

		$('#input').editFor(socket);
		if (checkAuth('admin')) {
			$('#editroom').click(function(){ location = 'room?id='+room.id });
			$('#auths').click(function(){ location = 'auths?id='+room.id });			
		} else {
			$('#editroom, #auths').hide();
		}
		console.log('Miaou!');
	});
})();
