(function(){

	function send(mid, verb, o){
		o = o || {};
		o.mid = mid;
		miaou.socket.emit('video.'+verb, o);
	}

	function on(vd){
		getUserMedia({video: true}, function(stream){
			vd.localStream = stream;
			vd.localVideo.src = window.URL.createObjectURL(stream);
			vd.localVideo.play();
		}, function(error){
			console.log("getUserMedia error: ", error);			
		});
	}
	
	function off(){
		
	}

	function render($c, m){
		var vd = $c.data('video');
		if (!vd) {
			var match = m.content.match(/^!!video\s*@(\w[\w_\-\d]{2,})/);
			if (!match) return console.log('invalid video message'); // should not happen because server is filtering
			var vd = {
				usernames:[m.authorname, match[1]],
				on:[false, false],
				index:-1
			};
			if (vd.usernames[0]===me.name) vd.index = 0;
			else if (vd.usernames[1]===me.name) vd.index = 1;
			$c.data('video', vd);
		}
		if (vd.index===-1) {
			$c.text(vd.usernames[0] + " proposed a video chat to " + vd.usernames[1]);
		} else {
			send(m.id, 'ping');
			$('<div>').addClass('video-status').append(
				$('<i>').text('Video chat with @'+vd.usernames[+!vd.index])
			).append(
				$('<button/>').text('Start').click(function(){ on(vd) })
			).appendTo($c);
			vd.localVideo = $('<video>').addClass('local')[0];
			$('<div>').append(vd.localVideo).append(
				$('<video>').addClass('remote')
			).appendTo($c);
		}
	}

	miaou.chat.plugins.video = {
		start: function(){
			miaou.md.registerRenderer(function($c, m){
				if (!m.content) return;
				var match = m.content.match(/^!!video @\S{3,}$/);
				if (!match) return;
				render($c, m);
				return true;
			});
			miaou.socket.on('video.msg', function(msg){
				console.log('video.msg', msg);
			});
		}
	}

})();
