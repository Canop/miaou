// deals with webrtc variants and prefixes

miaou(function(webrtc){
				
	["RTCPeerConnection", "RTCSessionDescription", "RTCIceCandidate"].forEach(function(k){
		window[k] = window[k] || window['moz'+k] || window['webkit'+k];
	});

	if (navigator.mozGetUserMedia) {
		webrtc.getUserMedia = navigator.mozGetUserMedia.bind(navigator);
		webrtc.config = {'iceServers':[{'url':'stun:23.21.150.121'}]};
	} else if (navigator.webkitGetUserMedia) {
		webrtc.getUserMedia = navigator.webkitGetUserMedia.bind(navigator);
		webrtc.config = {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]};
	} else {
		console.log("webrtc: navigator not detected");
	}

	webrtc.constraints = { 'optional': [ {'DtlsSrtpKeyAgreement': true}, {'RtpDataChannels': true} ]};
});
