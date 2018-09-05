let v = 25;
function log(){
	console.log(`SW${v}>`, ...arguments);
}
log("log from miaou-sw service worker");

let base = self.location.toString().replace(/\/static\/[^\/]+$/, "");

log('base:', base);

async function onPushEvent(){
	// Today web push events don't contain any payload, so we
	// must query the server to know why even we've been notified
	log("I will call:", base + "/json/pings");
	let resp = await fetch(base + "/json/pings");
	let data = await resp.json();
	// we look for already displayed notifications, to replace them
	let currentNotifications = await registration.getNotifications();
	for (notification of currentNotifications) { // there should be one current at most
		console.log("merging old notification", notification);
		notification.close();
	}
	let pings = data.pings;
	log('data:', data);
	let room = {id: pings[0].r, name: pings[0].rname};
	let authorname = pings[0].authorname;
	for (let i=1; i<pings.length; i++) {
		if (pings[i].r!==room.id) {
			console.log("different rooms");
			room = null;
		}
		if (pings[i].authorname!==authorname) {
			console.log("different authors");
			authorname = null;
		}
	}
	let title = "Miaou";
	if (room) title += ` - ${room.name}`;
	let body = `You've been pinged`;
	if (pings.length>1) body += ` ${pings.length} times`;
	if (authorname) body += ` by ${authorname}`;
	let icon = `${base}/static/M-192.png`;
	let badge = `${base}/static/M-192.png`;
	self.registration.showNotification(title, {
		body,
		data,
		icon,
		badge
	});
}

async function goToPage(url){
	let windows = await clients.matchAll({
		type: "window",
		includeUncontrolled: true
	});
	for (let window of windows) {
		console.log("window client url:", window.url);
		if (window.url==url) {
			await window.focus();
			return;
		}
	}
	// notification is most often called when there's no connexion, so we
	//  should have to open a new window
	await clients.openWindow(url);
}

self.addEventListener("push", function(event){
	log("got push event:", event);
	event.waitUntil(onPushEvent());
});

self.addEventListener('notificationclose', function(event){
	console.log("dismissed notification:", event.notification);
});

self.addEventListener('notificationclick', function(event){
	console.log("clicked notification:", event.notification);
	let data = event.notification.data;
	console.log('data:', data);
	if (!data || !data.pings) {
		console.log("abnormal notification", event.notification);
		return;
	}
	let url = base;
	if (data.pings.length) {
		let ping = data.pings[0]; // let's just choose the first one
		url = `${base}/${ping.r}#${ping.mid}`;
	}
	event.waitUntil(goToPage(url));
});
