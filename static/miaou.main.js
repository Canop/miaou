var miaou = miaou || {};
(function(){
	var NB_MESSAGES = 100,
		nbUnseenMessages = 0, nbUnseenPings = 0,
		messages = [],
		users = [],
		room = localStorage['lastRoom'] || 'miaou beta',
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
			console.log('bbb');
			miaou.dialog({
				title: "Please log in",
				content: $c,
				buttons: {
					OK: function(){
						if (!$('#username_input')[0].validity.valid){ // not compatible with IE, that's fine 
							alert('Please type a 3 to 20 characters long name');
							return false;
						}
						localStorage['username'] = username = $('#username_input').val();
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

	function addMessage(message){
		var user = message.user, content = message.content;
		// todo quote
		// fixme ensure tags doesn't interlace
		content = content.replace(/</g,'&lt;').replace(/>/g,'&gt;')
			.replace(/(^|\W)`([^\*]+)`(\W|$)/g, "$1<code>$2</code>$3")
			.replace(/(^|\W)\*\*([^\*<>]+)\*\*(\W|$)/g, "$1<b>$2</b>$3")
			.replace(/(^|\W)\*([^\*]+)\*(\W|$)/g, "$1<i>$2</i>$3")
			.replace(/(^|\n)(?:    |\t)([^\n]+)(?=\n|$)/g, "$1<code class=indent>$2</code>")
			.trim()
			.replace(/\n/g,'<br>');
		if (/^https?:\/\/[^\s]+\.(bmp|png|webp|gif|jpg|jpeg|svg)$/i.test(content)) {
			content = $('<img>').attr('src',content).load(function(){ $('#messages').scrollTop($('#messages')[0].scrollHeight) });
		} else {
			content = content.replace(/(^|\s)\[([^\]]+)\]\(([^\)\s"<>]+)\)(\s|$)/g, '$1<a target=_blank href="$3">$2</code>$4')
			// todo find something more elegant than the following trick...
			// the following applies replacement to what isn't in a html tag
			content = ('>'+content+'<').replace(/>([^<]+)</g, function(_,s){
				return '>'+s.replace(/(https?|ftp):\/\/[^\s"\(\)\[\]]+/ig, function(href){
					return '<a target=_blank href="'+href+'">'+href+'</a>';
				})+'<'
			}).slice(1,-1);
		}
		var $content = $('<div>').addClass('content').append(content);
		var $md = $('<div>').addClass('message').append(
			$('<div>').addClass('user').text(user.name)
		).append($content).data('id', message.id);
		if (user.name===me.name) $md.addClass('me');
		$md.hide().appendTo('#messages').fadeIn('slow');
		if ($content.height()>150) {
			$content.addClass("closed");
			$md.append('<div class=opener>');
		}
		$('#messages').scrollTop($('#messages')[0].scrollHeight);
	}
	
	function addToUserList(user) {
		for (var i=0; i<users.length; i++) {
			if (users[i].name===user.name) {
				users.splice(i,1);
				break;
			}
		}
		users.push(user);
		$('#users').html(users.map(function(u){ return '<span class=user>'+u.name+'</span>' }).reverse().join('<br>'));
	}
	
	miaou.init = function(){
		var socket = io.connect(location.origin);
		
		$(function(){
			loadUser(function(){
				socket.emit('enter', {user:me, room:room});
				
				$('#roomname').text('Room : ' + room);
				document.title = room;
				vis(function(){
					if (vis()) {
						nbUnseenMessages = 0; nbUnseenPings = 0;
						document.title = room;						
					}
				});
				
				socket.on('message', function(message){
					addMessage(message);
					addToUserList(message.user);
					if (!vis()) {
						if (pingRegex(me.name).test(message.content)) {
							miaou.notify(room, message.user, message.content);
							nbUnseenPings++;
						}
						document.title = (nbUnseenPings?'*':'') + ++nbUnseenMessages + ' - ' + room;
					}
				});
				socket.on('enter', function(user){
					addToUserList(user);
				});
				
				var $input = $('#input');
				function sendInput(){
					var txt = $input.val();
					if (txt.trim().length){
						socket.emit('message', txt);
						$input.val('');
					}
				}
				$input.on('keyup', function(e){
					if (e.which==13 && e.ctrlKey) sendInput();
				}).focus();
				$('#send').on('click', sendInput);
				console.log('Miaou!');
				
				$('#users').on('click', '.user', function(){
					var val = $input.val(), username = this.innerHTML;
					if (pingRegex(username).test(val)) {
						$input.val(val.replace(pingRegex(username), '')); // FIXME : lets too many spaces
					} else {
						$input.val(val+' @'+this.innerHTML+' ');
					}
				});
				$('#messages').on('click', '.message .content img', function(){ window.open(this.src) });
				$('#messages').on('click', '.opener', function(){
					$(this).removeClass('opener').addClass('closer').closest('.message').find('.content').removeClass('closed');
				}).on('click', '.closer', function(){
					$(this).removeClass('closer').addClass('opener').closest('.message').find('.content').addClass('closed');					
				});
			});
		});
	}
})();
