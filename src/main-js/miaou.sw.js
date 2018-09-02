// service worker things
miaou(function(sw, chat, ws){
	console.log("from miaou.sw");

	let subscription;
	let registered = false;

	navigator.serviceWorker.register("static/miaou.sw.min.js?v=20")
	.then(onSWRegistered)
	.catch(function(err){
		console.log("SW registration failed:", err);
	});

	function urlBase64ToUint8Array(base64String){
		const padding = '='.repeat((4 - base64String.length % 4) % 4);
		const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
		const rawData = window.atob(base64);
		const outputArray = new Uint8Array(rawData.length);
		for (let i = 0; i < rawData.length; ++i) {
			outputArray[i] = rawData.charCodeAt(i);
		}
		return outputArray;
	}

	async function onSWRegistered(reg){
		console.log("SW registration worked:", reg);
		subscription = await reg.pushManager.getSubscription();
		if (subscription) {
			console.log("already a subscription");
		} else {
			console.log("asking for a subscription");
			let resp = await fetch("vapidPublicKey");
			let vapidPublicKey = await resp.text();
			let convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
			console.log('convertedVapidKey:', convertedVapidKey);
			subscription = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: convertedVapidKey
			});
		}
		console.log('subscription:', subscription);
		tryRegister();
	}

	chat.on("ready", tryRegister);

	function tryRegister(){
		console.log('tryRegister');
		if (registered) return;
		if (chat.state!=='connected') return console.log("chat not ready");
		if (!subscription) return console.log("no subscription");
		console.log("chat ready, have subscription. Trying to register web-push");
		ws.emit('web-push_register', subscription);
		registered = true;
	}
});
