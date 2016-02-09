miaou(function(plugins, chat, gui, locals, md, webrtc, ws){

	// The video descriptor, one per displayed miaou !!video message
	// medias : something like {video:true, audio:true}
	function VD(mid, usernames, medias){
		this.medias = medias;
		this.mid = mid;
		this.usernames = usernames;
		this.index = -1;
		this.started = false;
		this.ready = [false, false]; // ready : message rendered (but maybe no accept)
		this.accept = [false, false]; // accept : user clicked the Start button and didn't click Stop
		if (usernames[0]===locals.me.name) this.index = 0;
		else if (usernames[1]===locals.me.name) this.index = 1;
		if (~this.index) this.ready[this.index] = true;
	}
	VD.prototype.render = function($c){ // renders the VD in a message, called only once
		$c.css('background','#F0EAD6');
		if (this.index===-1) {
			$c.text(this.usernames[0] + " proposed a video/audio chat to " + this.usernames[1]);
			return;
		}
		this.$controls = $('<div>').addClass('video-controls').append(
			$('<i>').text((this.medias.video ? 'Video' : 'Audio') + ' chat with @'+this.usernames[+!this.index])
		).appendTo($c);
		this.$status = $('<div>').addClass('video-status').appendTo($c);
		this.localVideo = $('<video autoplay muted>').addClass('local').css({
			flex:'0 1 300px', margin:'5px'
		})[0];
		this.remoteVideo = $('<video autoplay>').addClass('remote').css({
			flex:'1 1 auto', margin:'5px'
		})[0];
		this.$cams = $('<div>').css({
			display:'flex', alignItems:'center', justifyContent:'space-around'
		}).addClass('video-cams').append(this.localVideo).append(this.remoteVideo).appendTo($c);
		this.off();
	}
	VD.prototype.update = function(){
		var iab = gui.isAtBottom();
		this.$controls.find('button').remove();
		this.$cams.hide();
		this.$status.show();
		if (!this.ready[+!this.index]) {
			this.$status.text(this.usernames[+!this.index]+" isn't ready right now");
			return;
		}
		if (this.accept[this.index]) {
			$('<button/>').text('Stop').click(this.off.bind(this)).appendTo(this.$controls);
		} else {
			$('<button/>').text('Start').click(this.on.bind(this)).appendTo(this.$controls);			
		}
		if (this.accept[0] && this.accept[1]) {
			if (this.medias.video) {
				this.$status.hide();
				this.$cams.show();
			} else {
				this.$status.text("Audio chat now running");
			}
		} else {
			this.$status.text(
				this.usernames[+!this.index]+
				(this.accept[+!this.index] ? " is waiting for you to accept" : " hasn't yet accepted")
			);
		}
		if (iab) {
			gui.scrollToBottom();
			$('video').load(gui.scrollToBottom);
		}
	}
	VD.prototype.send = function(verb, o){
		o = o || {};
		o.mid = this.mid;
		console.log('OUT video.'+verb+' ->', o);
		ws.emit('video.'+verb, o);
	}
	VD.prototype.sendMsg = function(msg){
		this.send('msg', {msg:msg});
		return this;
	}
	VD.prototype.on = function(){
		var vd = this;
		webrtc.getUserMedia(this.medias, function(stream){
			vd.localStream = stream;
			vd.localVideo.src = window.URL.createObjectURL(stream);
			vd.localVideo.play();
			vd.accept[vd.index] = true;
			vd.sendMsg('on');
			if (vd.index===0) vd.tryStart();
			vd.update();
		}, function(error){
			console.log("getUserMedia error: ", error);			
		});
	}
	VD.prototype.cut = function(){
		this.started = false;
		if (this.localStream) this.localStream.stop();
		if (this.pc) {
			this.pc.close();
			this.pc = null;
			console.log('pc removed');
		}
	}
	VD.prototype.off = function(){
		this.accept[this.index] = false;
		this.cut();
		this.update();
		this.sendMsg('off');
	}
	VD.prototype.tryStart = function(){
		if (this.started || !this.localStream) return;
		var vd = this;
		try {
			this.pc = new RTCPeerConnection(webrtc.config, webrtc.constraints);
			this.pc.onicecandidate = function(event){
				console.log('handleIceCandidate event: ', event);
				if (event.candidate) {
					vd.sendMsg({
						type: 'candidate',
						label: event.candidate.sdpMLineIndex,
						id: event.candidate.sdpMid,
						candidate: event.candidate.candidate
					});
				} else {
					console.log('End of candidates.');
				}
			};
			this.pc.onaddstream = function(event) {
				console.log('Remote stream added.');
				vd.remoteVideo.src = window.URL.createObjectURL(event.stream);
				vd.remoteStream = event.stream;
			};
			this.pc.onremovestream = function(event){
				console.log('Remote stream removed. Event: ', event);
			};
			console.log('Created RTCPeerConnnection');
		} catch (e) {
			console.log('Failed to create PeerConnection, exception: ' + e.message);
			return;
		}
		this.pc.addStream(this.localStream);
		if (this.accept[0] && this.accept[1]) {
			this.started = true;
			if (this.index===0) {
				console.log('Sending offer to peer');
				this.pc.createOffer(this.setLocalAndSendMessage.bind(this), function(e){ console.log('createOffer() error: ', e) });				
			}
		}
	}
	VD.prototype.doAnswer = function(){
		console.log('Sending answer to peer.');
		this.pc.createAnswer(this.setLocalAndSendMessage.bind(this), null, {});
	}
	VD.prototype.setLocalAndSendMessage = function(sessionDescription){
		console.log('setLocalAndSendMessage sending message' , sessionDescription);
		sessionDescription.sdp = webrtc.preferOpus(sessionDescription.sdp);
		this.pc.setLocalDescription(sessionDescription);
		this.sendMsg(sessionDescription);
	}
	VD.prototype.receiveMsg = function(message){
		this.ready[+!this.index] = true;
		if (message === 'got user media') {
			this.tryStart();
		} else if (message === 'on') {
			this.accept[+!this.index] = true;
			this.tryStart();
		} else if (message === 'off') {
			this.accept[+!this.index] = false;
			this.cut();
			this.sendMsg('ok'); // so that the other browser knows we're connected if it didn't
		} else if (message.type === 'offer') {
			if (this.index===1 && !this.started) {
				this.tryStart();
			}
			this.pc.setRemoteDescription(new RTCSessionDescription(message));
			this.doAnswer();
		} else if (message.type === 'answer' && this.started) {
			console.log('Setting remote description');
			this.pc.setRemoteDescription(new RTCSessionDescription(message));
		} else if (message.type === 'candidate' && this.started) {
			var candidate = new RTCIceCandidate({
				sdpMLineIndex: message.label,
				candidate: message.candidate
			});
			console.log('Setting ice candidate');
			this.pc.addIceCandidate(candidate);
		}
		this.update();
	}

	plugins.video = {
		start: function(){
			md.registerRenderer(function($c, m, oldMessage){
				if (!m.content || oldMessage) return;
				var match = m.content.match(/^!!(video|audio)\s*@(\w[\w_\-\d]{2,})/);
				if (!match) return;
				if (!$c.closest('#mwin,#messages').length) {
					$c.text(match[1]);
					return true;
				}
				var vd = $c.dat('video');
				if (!vd) {
					if ($c.closest('#mwin').length) {
						// if we're inside a mwin, we'll try to get the content from the
						//  standard message representation
						var $normalMC = $('#messages .message[mid='+m.id+'] .content');
						if ($normalMC.length) {
							$c.append($normalMC.contents());
							vd = $normalMC.dat('video');
							$normalMC.dat('video', null);
							$normalMC.text(m.content);
							$c.dat('video', vd).find('video').each(function(){ this.play() });
							return true;
						}
					}
					if (!vd) {
						var medias = {audio:true, video:match[1]==='video'};
						vd = new VD(m.id, [m.authorname, match[2]], medias);
					}
					$c.dat('video', vd);
				}
				vd.render($c);
				return true;
			});
			md.registerUnrenderer(function($c, m){
				if (!m.content) return;
				var match = m.content.match(/^!!(video|audio)\s*@(\w[\w_\-\d]{2,})/);
				if (!match) return;
				var vd = $c.dat('video');
				if ($c.closest('#mwin').length) {
					var $normalMC = $('#messages .message[mid='+m.id+'] .content');
					if ($normalMC.length && vd) {
						// returning to normal message
						$normalMC.append($c.contents());
						$normalMC.dat('video', vd).find('video').each(function(){ this.play() });
						return true;
					}
				}
				if (vd) vd.off();
			});
			ws.on('video.msg', function(arg){
				console.log('IN video.msg <-', arg);
				$('.message[mid='+arg.mid+'] .content').each(function(){
					var vd = $(this).dat('video');
					if (vd) vd.receiveMsg(arg.msg);
				});
			});
		}
	}
});
