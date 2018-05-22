miaou(function(plugins, chat, gui, locals, md, webrtc, ws){

	// the config is fetched by the client on first video message rendering, then stored here
	var webrtcConfig = null;
	const rtcEvents = [
		"negotiationneeded", // generated on add stream or lost connection
		"signalingstatechange",
		"icecandidate", "iceconnectionstatechange", "icegatheringstatechange",
		"removestream",
		"track"
	];

	// The video descriptor, one per displayed miaou !!video message
	// medias : something like {video:true, audio:true}
	function VD(mid, usernames, medias){
		this.medias = medias;
		this.mid = mid;
		this.usernames = usernames;
		this.started = false;
		this.ready = [false, false]; // ready : message rendered (but maybe no accept)
		this.accept = [false, false]; // accept : user clicked the Start button and didn't click Stop
		this.index = -1; // 0 for message author (who initiates the "start" and the rpc call)
		if (usernames[0]===locals.me.name) this.index = 0;
		else if (usernames[1]===locals.me.name) this.index = 1;
		if (~this.index) this.ready[this.index] = true;
		this.pc = null; // the rtc peer connection
		this.localVideo = null; // DOM video
		this.removeVideo = null; // DOM video
	}
	VD.prototype.log = function(){
		console.log("video("+this.mid+")", ...arguments);
	}
	VD.prototype.render = function($c){ // renders the VD in a message, called only once
		this.log("render");
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
		this.send("ready");
		this.update();
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
			$('<button>').text('Stop').click(()=>{
				this.off();
			}).appendTo(this.$controls);
		} else {
			$('<button>').text('Start').click(()=>{
				this.on();
			}).appendTo(this.$controls);
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
				(this.accept[+!this.index] ? " is waiting for you to accept" : " hasn't accepted")
			);
		}
		if (iab) {
			gui.scrollToBottom();
			$('video').on("loadeddata", gui.scrollToBottom);
		}
	}
	VD.prototype.send = function(verb, arg){
		var message = {
			mid: this.mid,
			verb: verb,
			arg: arg
		};
		this.log("send ---> ", message.verb, arg);
		ws.emit("video.msg", message);
	}
	VD.prototype.receive = function(message){
		var arg = message.arg;
		this.log('<--- receive:', message.verb, arg);
		this.ready[+!this.index] = true;
		switch (message.verb) {
		case "ready-too":
			break;
		case "ready":
			if (this.accept[this.index]) this.send("on");
			else this.send("ready-too");
			break;
		case "on":
			this.accept[+!this.index] = true;
			break;
		case "off":
			this.accept[+!this.index] = false;
			this.cut();
			break;
		case "offer":
			this.accept[+!this.index] = true;
			this.receiveOffer(arg);
			break;
		case "answer":
			this.accept[+!this.index] = true;
			this.receiveAnswer(arg);
			break;
		case "ice-candidate":
			this.receiveIceCandidate(arg);
			break;
		default:
			this.log("unknown message verb:", message.verb);
		}
		this.maybeStart();
		this.update();
	}
	VD.prototype.on = function(){
		this.accept[this.index] = true;
		if (this.index===0) this.maybeStart();
		if (!this.started) this.send('on');
		this.update();
	}
	VD.prototype.createPeerConnection = function(){
		try {
			this.pc = new RTCPeerConnection(webrtcConfig);
		} catch (err) {
			this.log("err in createPeerConnection:", err);
		}
		rtcEvents.forEach(eventType => {
			this.pc["on"+eventType] = (event) => {
				this.log("rtc event", eventType, ":", event);
				try {
					this["on"+eventType](event);
				} catch (err) {
					this.log("err in handling event", eventType, event, ":", err);
				}
				this.update();
			};
		});
	}
	VD.prototype.maybeStart = function(){
		if (this.started) return;
		if (this.index!==0) return; // the rpc exchange is always started by the message author
		if (!this.ready[0] || !this.ready[1]) return; // one of the users isn't connected
		if (!this.accept[0] || !this.accept[1]) return; // one of the users hasn't acepted the message
		this.start();
	}
	VD.prototype.start = function(){ // only called if user is mesage author and everything's ready
		this.started = true;
		this.createPeerConnection();
		navigator.mediaDevices.getUserMedia(this.medias)
		.then(stream => {
			this.localVideo.srcObject = stream;
			stream.getTracks().forEach(track => {
				this.pc.addTrack(track, stream);
				// this is supposed to trigger the onnegotiationneeded event
				//  whose handling will send an offer
			});
			this.localVideo.play();
		})
		.catch(err => this.log("err in getUserMedia:", err));
	}
	VD.prototype.onnegotiationneeded = function(event){
		this.pc.createOffer()
		.then(offer => {
			return this.pc.setLocalDescription(offer);
		})
		.then(() => {
			this.send("offer", {
				sdp: this.pc.localDescription
			});
		})
		.catch(err => this.log("err in hangling negotiationneeded:", err));
	}
	VD.prototype.receiveOffer = function(message){ // only called if user is NOT mesage author and everybody accepted
		if (!this.accept[this.index]) throw new Error("We don't want that offer");
		this.createPeerConnection();
		this.pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
		.then(() => {
			return navigator.mediaDevices.getUserMedia(this.medias)
		})
		.then(stream => {
			this.localVideo.srcObject = stream;
			stream.getTracks().forEach(track => {
				this.pc.addTrack(track, stream);
			});
			return this.pc.createAnswer();
		})
		.then(answer => {
			return this.pc.setLocalDescription(answer);
		})
		.then(() => {
			this.send("answer", {
				sdp: this.pc.localDescription
			});
		})
		.catch(err => this.log("err in receiveOffer:", err));
	}
	VD.prototype.receiveAnswer = function(message){
		this.pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
		.catch(err => this.log("err in receiveOffer:", err));
	}
	VD.prototype.onicecandidate = function(event){
		if (!event.candidate) {
			this.log("no more ICE candidates");
			return;
		}
		this.send("ice-candidate", {
			candidate: event.candidate
		});
	}
	VD.prototype.receiveIceCandidate = function(message){
		var candidate = new RTCIceCandidate(message.candidate);
		this.pc.addIceCandidate(candidate)
		.catch(err => this.log("err in receiveIceCandidate:", err));
	}
	VD.prototype.ontrack = function(event){ // called when a new track is added on the peer connection
		this.remoteVideo.srcObject = event.streams[0];
		this.remoteVideo.play();
	}
	VD.prototype.onremovestream = function(event){ // some problems, probably
		this.log("lost stream");
		this.cut();
	}
	VD.prototype.oniceconnectionstatechange = function(event){
		this.log("new ice connection state:", this.pc.iceConnectionState);
		switch (this.pc.iceConnectionState) {
		case "closed":
		case "failed":
		case "disconnected":
			this.cut();
		}
	}
	VD.prototype.onsignalingstatechange = function(event){
		this.log("new signaling state:", this.pc.signalingState);
		switch (this.pc.signalingState) {
		case "closed":
			this.cut();
		}
	}
	VD.prototype.onicegatheringstatechange = function(event){
		this.log("new ice gathering state:", this.pc.iceGatheringState);
	}
	VD.prototype.cut = function(){
		this.log("cut");
		this.started = false;
		if (this.pc) {
			rtcEvents.forEach(eventType => {
				this.pc["on"+eventType] = null;
			});
		}
		if (this.remoteVideo.srcObject) {
			this.remoteVideo.srcObject.getTracks().forEach(track => {
				this.log("stopping track", track.label);
				track.stop();
			});
		}
		if (this.localVideo.srcObject) {
			this.localVideo.srcObject.getTracks().forEach(track => {
				this.log("stopping track", track.label);
				track.stop();
			});
		}
		if (this.pc) {
			this.pc.close();
			this.pc = null;
		}
	}
	VD.prototype.off = function(){
		this.log("off");
		this.accept[this.index] = false;
		this.cut();
		this.update();
		this.send('off');
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
				if (!webrtcConfig) {
					ws.emit("video.getConfig");
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
			ws.on('video.setConfig', function(arg){
				webrtcConfig = arg;
			});
			ws.on('video.msg', function(message){
				$('.message[mid='+message.mid+'] .content').each(function(){
					var vd = $(this).dat('video');
					if (vd) vd.receive(message);
				});
			});
		}
	}
});
