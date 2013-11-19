var miaou = miaou || {};
(function(){
	var NB_MESSAGES = 100,
		nbUnseenMessages = 0, nbUnseenPings = 0,
		users = [],
		oldestMessageTime,
		room = 'miaou',
		me = {name:'anonymous'};
		
	function loadUser(cb){
		var username = localStorage['username'];
		if (username) {
			me = {name: username};
			cb();
		} else {
			var $c = $('<div>');
			$c.append(
				$('<p>').html(
					"Don't forget we're still in beta, so try to be helpful :"+
					" Pick a name by which you will be recognized."+
					"<br>Choose wisely (not &quot;wisely&quot;)."
				)
			);
			$c.append(
				$('<table>').append(
					$('<tr>').append('<th id=username_label>Login :</th>').append('<input size=20 pattern="\\w[\\w_\\-\\d]{2,19}" id=username_input>')
				)
			);
			// other fields (SO id, MH id, etc.) will come here
			miaou.dialog({
				title: "Please log in",
				content: $c,
				buttons: {
					OK: function(){
						var input = document.getElementById('username_input');
						if (!input.validity.valid){ // not compatible with IE, that's fine 
							alert('Please type a 3 to 20 characters long name');
							return false;
						} else if (/wisely/i.test(input.value)) {
							alert('More wisely, less "wisely", please.');
							return false;
						}
						localStorage['username'] = username = input.value;
						me = {name: username}
						cb();
					}
				}
			});
			$('#username_input').focus();
		}
	}
	
	function pingRegex(name) {
		return new RegExp('@'+name+'(\\b|$)')
	}

	function scrollToBottom(){
		$('#messages').scrollTop($('#messages')[0].scrollHeight)
	}

	function addMessage(message){
		var content = message.content, isOld=false;
		//~ console.log(message);
		if (oldestMessageTime===undefined || message.created<oldestMessageTime) {
			isOld = true;
			oldestMessageTime = message.created;
		}
		content = content
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
		// the following applies replacement to what isn't in a html tag
		content = ('>'+content+'<').replace(/>([^<]+)</g, function(_,s){
			return '>'+s.replace(/(https?|ftp):\/\/[^\s"\(\)\[\]]+/ig, function(href){
				return '<a target=_blank href="'+href+'">'+href+'</a>';
			})+'<'
		}).slice(1,-1);
		var $content = $('<div>').addClass('content').append(content);
		var $md = $('<div>').addClass('message').append(
			$('<div>').addClass('user').text(message.authorname)
		).append($content).data('id', message.id);
		if (message.authorname===me.name) $md.addClass('me');
		$md.hide()[isOld?'prependTo':'appendTo']('#messages').fadeIn('fast');
		if ($content.height()>150) {
			$content.addClass("closed");
			$md.append('<div class=opener>');
		}
		$content.find('img').load(scrollToBottom);
		scrollToBottom();
	}
	
	function showError(error){
		console.log('ERROR', error);
		var $md = $('<div>').addClass('message error').append(
			$('<div>').addClass('user error').text("Miaou Server")
		).append(error).appendTo('#messages');
		scrollToBottom();
	}
	
	function addToUserList(user) {
		for (var i=0; i<users.length; i++) {
			if (users[i].name===user.name) {
				users.splice(i,1);
				break;
			}
		}
		users.push(user);
		$('#users').html(users.map(function(u){ return '<span class=user>'+u.name+'</span>' }).reverse().join(''));
	}
	
	$(function(){
		var socket = io.connect(location.origin);
		loadUser(function(){
			socket.emit('enter', {user:me, room:room});

			document.title = room;
			vis(function(){
				if (vis()) {
					nbUnseenMessages = 0; nbUnseenPings = 0;
					document.title = room;						
				}
			});
			
			socket.on('message', function(message){
				addMessage(message);
				addToUserList({id: message.author, name: message.authorname});
				if (!vis()) {
					if (pingRegex(me.name).test(message.content)) {
						miaou.notify(room, message.authorname, message.content);
						nbUnseenPings++;
					}
					document.title = (nbUnseenPings?'*':'') + ++nbUnseenMessages + ' - ' + room;
				}
			}).on('room', function(room){
				$('#roomname').text('Room : ' + room.name);
				$('#roomdescription').text(room.description);
			}).on('enter', addToUserList).on('error', showError);
			
			$('#messages').on('click', '.message .content img', function(){ window.open(this.src) })
			.on('click', '.opener', function(){
				$(this).removeClass('opener').addClass('closer').closest('.message').find('.content').removeClass('closed');
			}).on('click', '.closer', function(){
				$(this).removeClass('closer').addClass('opener').closest('.message').find('.content').addClass('closed');					
			});

			$('#input').editFor(socket);
			console.log('Miaou!');
		});
	});
})();
