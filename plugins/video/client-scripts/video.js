(function(){
	
	"use strict";
	
	// FIXME ensure there's only one VD isStarted at most
	// FIXME allows the opening in a mwin
	// FIXME use additional messages to let user with index 0 know he can starts the sequence
	
	// I'll make this configurable as soon as somebody asks for it
	var pc_config = webrtcDetectedBrowser === 'firefox' ?
	  {'iceServers':[{'url':'stun:23.21.150.121'}]} : // number IP
	  {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]
	};
	var pc_constraints = {
	  'optional': [
		{'DtlsSrtpKeyAgreement': true},
		{'RtpDataChannels': true}
	]};
	  
	// The video descriptor, one per displayed miaou !!video message
	function VD(mid, usernames){
		this.mid = mid;
		this.usernames = usernames;
		this.index = -1;
		this.isStarted = false;
		if (usernames[0]===me.name) this.index = 0;
		else if (usernames[1]===me.name) this.index = 1;
	}
	VD.prototype.render = function($c){ // renders the VD in a message, called only once
		if (this.index===-1) {
			$c.text(this.usernames[0] + " proposed a video chat to " + this.usernames[1]);
			return;
		}
		$('<div>').addClass('video-status').append(
			$('<i>').text('Video chat with @'+this.usernames[+!this.index])
		).append(
			$('<button/>').text('Start').click(this.on.bind(this))
		).appendTo($c);
		this.localVideo = $('<video autoplay muted>').addClass('local').css({width:'200px',height:'130px'})[0];
		this.remoteVideo = $('<video autoplay>').addClass('remote')[0];
		$('<div>').append(this.localVideo).append(this.remoteVideo).appendTo($c);
		this.send('ping');
	}
	VD.prototype.send = function(verb, o){
		o = o || {};
		o.mid = this.mid;
		console.log('OUT video.'+verb+' ->', o);
		miaou.socket.emit('video.'+verb, o);
	}
	VD.prototype.sendMsg = function(msg){
		this.send('msg', {msg:msg});
	}
	VD.prototype.on = function(){
		var vd = this;
		getUserMedia({video: true}, function(stream){
			vd.localStream = stream;
			vd.localVideo.src = window.URL.createObjectURL(stream);
			vd.localVideo.play();
			if (vd.index===0) vd.tryStart();
		}, function(error){
			console.log("getUserMedia error: ", error);			
		});
	}
	VD.prototype.off = function(){
		console.log('off');
		this.isStarted = false;
		this.pc.close();
		this.pc = null;
		this.sendMsg('bye');
	}
	VD.prototype.tryStart = function(){
		if (this.isStarted || !this.localStream) return;
		var vd = this;
		try {
			this.pc = new RTCPeerConnection(pc_config, pc_constraints);
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
		this.isStarted = true;
		if (this.index===0) {
			console.log('Sending offer to peer');
			this.pc.createOffer(this.setLocalAndSendMessage.bind(this), function(e){ console.log('createOffer() error: ', e) });
		}
	}
	VD.prototype.doAnswer = function(){
		console.log('Sending answer to peer.');
		this.pc.createAnswer(this.setLocalAndSendMessage.bind(this), null, {});
	}
	VD.prototype.setLocalAndSendMessage = function(sessionDescription){
		console.log('setLocalAndSendMessage sending message' , sessionDescription);
		sessionDescription.sdp = preferOpus(sessionDescription.sdp);
		this.pc.setLocalDescription(sessionDescription);
		this.sendMsg(sessionDescription);
	}
	VD.prototype.receiveMsg = function(message){
		if (message === 'got user media') {
			this.tryStart();
		} else if (message.type === 'offer') {
			if (this.index===1 && !this.isStarted) {
				this.tryStart();
			}
			this.pc.setRemoteDescription(new RTCSessionDescription(message));
			this.doAnswer();
		} else if (message.type === 'answer' && this.isStarted) {
			this.pc.setRemoteDescription(new RTCSessionDescription(message));
		} else if (message.type === 'candidate' && this.isStarted) {
			var candidate = new RTCIceCandidate({
				sdpMLineIndex: message.label,
				candidate: message.candidate
			});
			this.pc.addIceCandidate(candidate);
		} else if (message === 'bye' && this.isStarted) {
			this.off();
		}		
	}

	miaou.chat.plugins.video = {
		start: function(){
			miaou.md.registerRenderer(function($c, m){
				if (!m.content) return;
				var match = m.content.match(/^!!video\s*@(\w[\w_\-\d]{2,})/);
				if (!match) return;				
				var vd = $c.data('video');
				if (!vd) {
					vd = new VD(m.id, [m.authorname, match[1]]);
					$c.data('video', vd);
				}
				vd.render($c);
				return true;
			});
			miaou.socket.on('video.msg', function(arg){
				console.log('IN video.msg <-', arg);
				var vd = $('.message[mid='+arg.mid+'] .content').eq(0).data('video');
				if (!vd) return console.log('No VD !');
				vd.receiveMsg(arg.msg);
			});
		}
	}

})();
