(function(){
	
	"use strict";
	
	// FIXME ensure there's only one VD running at most
	// FIXME allows the opening in a mwin
	
	// I'll make this configurable as soon as somebody asks for it
	var pc_config = webrtcDetectedBrowser === 'firefox' ?
	  {'iceServers':[{'url':'stun:23.21.150.121'}]} :
	  {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]
	};
	var pc_constraints = {
	  'optional': [
		{'DtlsSrtpKeyAgreement': true},
		{'RtpDataChannels': true}
	]};
	  
	// The video descriptor, one per displayed miaou !!video message
	function VD(mid, usernames, audio){
		this.audio = audio;
		this.mid = mid;
		this.usernames = usernames;
		this.index = -1;
		this.started = false;
		this.ready = [false, false]; // ready : message rendered (but maybe no accept)
		this.accept = [false, false]; // accept : user clicked the Start button and didn't click Stop
		if (usernames[0]===me.name) this.index = 0;
		else if (usernames[1]===me.name) this.index = 1;
		if (~this.index) this.ready[this.index] = true;
	}
	VD.prototype.render = function($c){ // renders the VD in a message, called only once
		$c.css('background','#F0EAD6');
		if (this.index===-1) {
			$c.text(this.usernames[0] + " proposed a video chat to " + this.usernames[1]);
			return;
		}
		this.$controls = $('<div>').addClass('video-controls').append(
			$('<i>').text('Video chat with @'+this.usernames[+!this.index])
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
		var iab = miaou.md.isAtBottom();
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
			this.$cams.show();
			this.$status.text("Both have accepted").hide();
		} else {
			this.$status.text(
				this.usernames[+!this.index]+
				(this.accept[+!this.index] ? " is waiting for you to accept" : " hasn't yet accepted")+
				" the video chat"
			);
		}
		if (iab) {
			miaou.md.scrollToBottom();
			$('video').load(miaou.md.scrollToBottom);
		}
	}
	VD.prototype.send = function(verb, o){
		o = o || {};
		o.mid = this.mid;
		console.log('OUT video.'+verb+' ->', o);
		miaou.socket.emit('video.'+verb, o);
	}
	VD.prototype.sendMsg = function(msg){
		this.send('msg', {msg:msg});
		return this;
	}
	VD.prototype.on = function(){
		var vd = this;
		var opts = {audio: true, video: true};
		if (this.audio) opts.video = false;
		
		getUserMedia(opts, function(stream){
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
		console.log('tryStart 1', !this.started, !!this.localStream);
		if (this.started || !this.localStream) return;
		console.log('tryStart 2');
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
		console.log('tryStart 3');
		console.log(this.index===0, this.ready[1], this.accept[0], this.accept[1], '=>', this.index===0 && this.ready[1] && this.accept[0] && this.accept[1]);
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
		sessionDescription.sdp = preferOpus(sessionDescription.sdp);
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

	miaou.chat.plugins.video = {
		start: function(){
			miaou.md.registerRenderer(function($c, m){
				if (!m.content) return;
				var videoMatch = m.content.match(/^!!video\s*@(\w[\w_\-\d]{2,})/);
				var audioMatch = m.content.match(/^!!audio\s*@(\w[\w_\-\d]{2,})/);
				if (!videoMatch && !audioMatch) return;				
				var vd = $c.data('video');
				if (!vd) {
					if (audioMatch) {
						vd = new VD(m.id, [m.authorname, match[1]], true);
					}
					if (videoMatch) {
						vd = new VD(m.id, [m.authorname, match[1]], false);
					}
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
