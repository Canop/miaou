miaou(function(plugins, chat, gui, locals, md, webrtc, ws){

	console.log("V 10");

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
		this.localStream = null;
		this.remoteStream = null;
		this.localVideo = null; // DOM video
		this.removeVideo = null; // DOM video
	}
	VD.prototype.render = function($c){ // renders the VD in a message, called only once
		console.log("render", this.mid);
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
		var vd = this;
		console.log("update", this.mid);
		var iab = gui.isAtBottom();
		this.$controls.find('button').remove();
		this.$cams.hide();
		this.$status.show();
		if (!this.ready[+!this.index]) {
			this.$status.text(this.usernames[+!this.index]+" isn't ready right now");
			console.log("other not ready");
			return;
		}
		if (this.accept[this.index]) {
			$('<button>').text('Stop').click(function(){
				vd.off();
			}).appendTo(vd.$controls);
		} else {
			$('<button>').text('Start').click(function(){
				vd.on();
			}).appendTo(vd.$controls);
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
			$('video').on("loadeddata", gui.scrollToBottom);
		}
	}
	VD.prototype.cut = function(){
		console.log("cut");
		this.started = false;
		if (this.localStream) {
			this.localStream.getTracks().forEach(function(track){
				console.log("stopping track", track.label);
				track.stop();
			});
		}
		if (this.pc) {
			this.pc.close();
			this.pc = null;
			console.log('pc removed');
		}
	}
	VD.prototype.off = function(){
		console.log("off");
		this.accept[this.index] = false;
		this.cut();
		this.update();
		this.send('off');
	}
	VD.prototype.send = function(verb, arg){
		var message = {
			mid: this.mid,
			verb: verb,
			arg: arg
		};
		console.log("send ---> ", message.verb, arg);
		ws.emit("video.msg", message);
	}
	VD.prototype.receive = function(message){
		var arg = message.arg;
		console.log('<--- receive message:', message.verb, arg);
		if (!this.ready[+!this.index]) {
			this.ready[+!this.index] = true;
			this.send("ready"); // this is useful if the other refreshed since we told them we're ready
		}
		switch (message.verb) {
		case "on":
			this.accept[+!this.index] = true;
			break;
		//case "off":
		//	this.accept[+!this.index] = false;
		//	this.cut();
		//	break;
		case "offer":
			this.receiveOffer(arg);
			break;
		case "answer":
			this.receiveAnswer(arg);
			break;
		case "ice-candidate":
			this.receiveIceCandidate(arg);
			break;
		default:
			console.log("unknown message verb:", message.verb);
		}
		this.maybeStart();
		this.update();
	}
	VD.prototype.on = function(){
		console.log("start clicked");
		this.accept[this.index] = true;
		if (this.index===0) this.maybeStart();
		if (!this.started) this.send('on');
		this.update();
	}
	VD.prototype.createPeerConnection = function(){
		try {
			this.pc = new RTCPeerConnection(webrtcConfig);
		} catch (err) {
			console.log("err in createPeerConnection:", err);
		}
		var vd = this;
		rtcEvents.forEach(function(eventType){
			vd.pc["on"+eventType] = function(event){
				console.log("rtc event", eventType, ":", event);
				try {
					vd["on"+eventType](event);
				} catch (err) {
					console.log("err in handling event", eventType, event, ":", err);
				}
				vd.update();
			};
		});
	}
	VD.prototype.maybeStart = function(){
		console.log("maybe start");
		if (this.started) return;
		if (this.index!==0) return; // the rpc exchange is always started by the message author
		if (!this.ready[0] || !this.ready[1]) return; // one of the users isn't connected
		if (!this.accept[0] || !this.accept[1]) return; // one of the users hasn't acepted the message
		this.start();
	}
	VD.prototype.start = function(){ // only called if user is mesage author and everything's ready
		console.log("do start");
		var vd = this;
		this.started = true;
		this.createPeerConnection();
		navigator.mediaDevices.getUserMedia(this.medias)
		.then(function(stream){
			this.localStream = stream;
			console.log("got local stream");
			vd.localVideo.srcObject = stream;
			stream.getTracks().forEach(function(track){
				vd.pc.addTrack(track, stream);
				// this is supposed to trigger the onnegotiationneeded event
				//  whose handling will send an offer
			});
			vd.localVideo.play();
		})
		.catch(function(err){
			console.log("err in getUserMedia:", err);
		});
	}
	VD.prototype.onnegotiationneeded = function(event){
		var vd = this;
		vd.pc.createOffer()
		.then(function(offer){
			return vd.pc.setLocalDescription(offer);
		})
		.then(function(){
			vd.send("offer", {
				sdp: vd.pc.localDescription
			});
		})
		.catch(function(err){
			console.log("err in hangling negotiationneeded:", err);
		});
	}
	VD.prototype.receiveOffer = function(message){ // only called if user is NOT mesage author and everybody accepted
		var vd = this;
		if (!vd.accept[vd.index]) throw new Error("We don't want that offer");
		vd.createPeerConnection();
		vd.pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
		.then(function(){
			return navigator.mediaDevices.getUserMedia(vd.medias)
		})
		.then(function(stream){
			vd.localStream = stream;
			vd.localVideo.srcObject = stream;
			stream.getTracks().forEach(function(track){
				vd.pc.addTrack(track, stream);
			});
			return vd.pc.createAnswer();
		})
		.then(function(answer){
			return vd.pc.setLocalDescription(answer);
		})
		.then(function(){
			vd.send("answer", {
				sdp: vd.pc.localDescription
			});
		})
		.catch(function(err){
			console.log("err in receiveOffer:", err);
		});
	}
	VD.prototype.receiveAnswer = function(message){
		this.pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
		.catch(function(err){
			console.log("err in receiveOffer:", err);
		});
	}
	VD.prototype.onicecandidate = function(event){
		if (!event.candidate) {
			console.log("no more ICE candidates");
			return;
		}
		this.send("ice-candidate", {
			candidate: event.candidate
		});
	}
	VD.prototype.receiveIceCandidate = function(message){
		console.log("receive ice candidate!", message);
		var candidate = new RTCIceCandidate(message.candidate);
		this.pc.addIceCandidate(candidate)
		.catch(function(err){
			console.log("err in receiveIceCandidate:", err);
		});
	}
	VD.prototype.ontrack = function(event){ // called when a new track is added on the peer connection
		console.log("GOT TRACK");
		this.remoteStream = event.streams[0];
		this.remoteVideo.srcObject = event.streams[0];
		this.remoteVideo.play();
	}
	VD.prototype.onremovestream = function(event){ // some problems, probably
		console.log("lost stream");
		this.cut();
	}
	VD.prototype.oniceconnectionstatechange = function(event){
		console.log("new ice connection state:", this.pc.iceConnectionState);
		switch (this.pc.iceConnectionState) {
		case "closed":
		case "failed":
		case "disconnected":
			this.cut();
		}
	}
	VD.prototype.onsignalingstatechange = function(event){
		console.log("new signaling state:", this.pc.signalingState);
		switch (this.pc.signalingState) {
		case "closed":
			this.cut();
		}
	}
	VD.prototype.onicegatheringstatechange = function(event){
		console.log("new ice gathering state:", this.pc.iceGatheringState);
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
				console.log('IN video.setConfig <-', arg);
				webrtcConfig = arg;
			});
			ws.on('video.msg', function(message){
				console.log('IN video.msg <-', message);
				$('.message[mid='+message.mid+'] .content').each(function(){
					var vd = $(this).dat('video');
					if (vd) vd.receive(message);
				});
			});
		}
	}
});
