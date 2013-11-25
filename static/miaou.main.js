var miaou = miaou || {};
(function(){
	var NB_MESSAGES = 100,
		nbUnseenMessages = 0, nbUnseenPings = 0,
		users = [],
		messages = [];
	
	function pingRegex(name) {
		return new RegExp('@'+name+'(\\b|$)')
	}

	function scrollToBottom(){
		$('#messages').scrollTop($('#messages')[0].scrollHeight)
	}

	function makeMessageDiv(message){
		var content = message.content
			.replace(/</g,'&lt;').replace(/>/g,'&gt;')
			.replace(/(^|\n)(?:&gt;\s*)([^\n]+)(?=\n|$)/g, "\n<span class=citation>$2</span>")
			.replace(/(^|\W)`([^`]+)`(?=\W|$)/g, "$1<code>$2</code>")
			.replace(/(^|\W)\*\*([^\*<>]+)\*\*(?=\W|$)/g, "$1<b>$2</b>")
			.replace(/(^|\W)\*([^\*<>]+)\*(?=\W|$)/g, "$1<i>$2</i>")
			.replace(/(^|\n)(?:    |\t)([^\n]+)(?=\n|$)/g, "$1<code class=indent>$2</code>")
			.trim()
			.replace(/(^|\n)(https?:\/\/[^\s<>]+)\.(bmp|png|webp|gif|jpg|jpeg|svg)(?=\n|$)/g, "$1<img src=$2.$3>") // exemple : http://mustachify.me/?src=http://www.librarising.com/astrology/celebs/images2/QR/queenelizabethii.jpg
			.replace(/(^|\n)(https?:\/\/[^\s<>?]+)\.(bmp|png|webp|gif|jpg|jpeg|svg)(\?[^\s<>?]*)?(?=\n|$)/g, "$1<img src=$2.$3$4>") // exemple : http://md1.libe.com/photo/566431-unnamed.jpg?height=600&modified_at=1384796271&ratio_x=03&ratio_y=02&width=900
			.replace(/\n+/g,'<br>')
			.replace(/(^|\s)\[([^\]]+)\]\((https?:\/\/[^\)\s"<>]+)\)(?=\s|$)/g, '$1<a target=_blank href="$3">$2</code>'); // exemple : [dystroy](http://dystroy.org)
		// the following applies replacement to what isn't in a html tag - todo : find somthing more elegant 
		content = ('>'+content+'<').replace(/>([^<]+)</g, function(_,s){
			return '>'+s.replace(/(https?|ftp):\/\/[^\s"\(\)\[\]]+/ig, function(href){
				return '<a target=_blank href="'+href+'">'+href+'</a>';
			})+'<'
		}).slice(1,-1);
		var $content = $('<div>').addClass('content').append(content);
		var $md = $('<div>').addClass('message').append(
			$('<div>').addClass('user').text(message.authorname)
		).append($content).data('message', message).attr('mid', message.id);
		if (message.authorname===me.name) $md.addClass('me');
		if ($content.height()>150) {
			$content.addClass("closed");
			$md.append('<div class=opener>');
		}
		$content.find('img').load(scrollToBottom);
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
				return; // later, with edition features, this behavior will change
			}
			messages.splice(insertionIndex, 0, message);
			$('#messages .message').eq(insertionIndex).before($md);
		} else {
			messages.push(message);
			$md.hide().appendTo('#messages').fadeIn('fast');
			addToUserList({id: message.author, name: message.authorname});
			if (!vis()) {
				if (pingRegex(me.name).test(message.content)) {
					miaou.notify(room, message.authorname, message.content);
					nbUnseenPings++;
				}
				document.title = (nbUnseenPings?'*':'') + ++nbUnseenMessages + ' - ' + (room ? room.name : 'no room');
			}
		}
		scrollToBottom();
	}
	
	function showError(error){
		console.log('ERROR', error);
		var $md = $('<div>').addClass('message error').append(
			$('<div>').addClass('user error').text("Miaou Server")
		).append(error).appendTo('#messages');
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

		vis(function(){
			if (vis()) {
				nbUnseenMessages = 0; nbUnseenPings = 0;
				document.title = room ? room.name : 'no room';						
			}
		});
		
		socket.on('message', function(message){
			addMessage(message);
		}).on('room', function(r){
			if (room.id!==r.id) {
				// due to a problem in express session management (no window session), we may be connected to
				// the bad room after a (silent) reconnect
				location.reload();
			}
			room = r;
			localStorage['successfulLoginLastTime'] = "yes";
			localStorage['room'] = room.id;
			document.title = room.name;
			$('#roomname').text('Room : ' + room.name);
			$('#roomdescription').text(room.description);
		}).on('enter', addToUserList).on('leave', updateUserList).on('error', showError);
		
		$('#messages').on('click', '.message .content img', function(){ window.open(this.src) })
		.on('click', '.opener', function(){
			$(this).removeClass('opener').addClass('closer').closest('.message').find('.content').removeClass('closed');
		}).on('click', '.closer', function(){
			$(this).removeClass('closer').addClass('opener').closest('.message').find('.content').addClass('closed');					
		}).on('mouseenter', '.message', function(){
			var message = $(this).data('message');
			$('<div>').addClass('messageinfo').text(moment(message.created*1000).fromNow()).appendTo(this);
		}).on('mouseleave', '.message', function(){
			$('.messageinfo').remove();
		});

		$('#input').editFor(socket);
		$('#help').click(function(){ window.open('help#Writing_Messages') });
		
		$('#changeroom').click(function(){ location='rooms' });
		$('#me').text(me.name);
		console.log('Miaou!');
	});
})();
