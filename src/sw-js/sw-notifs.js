let v = 33;
function log(){
	console.log(`SW${v}>`, ...arguments);
}

let base = self.location.toString().replace(/\/[^\/]+$/, "");
let nextTag = Date.now();

class PingsAbstract{
	constructor(pings){
		this.pings = pings;
		this.authornames = new Set;
		this.roomIds = new Set;
		for (let ping of pings) {
			this.authornames.add(ping.authorname);
			this.roomIds.add(ping.r);
		}
	}
	nbRooms(){
		return this.roomIds.size;
	}
	nbAuthors(){
		return this.authornames.size;
	}
	title(){
		let title = "Miaou";
		if (this.nbRooms()==1) title += ` - ${this.pings[0].rname}`;
		return title;
	}
	body(){
		let body = `You've been pinged`;
		let nbpings = this.pings.length;
		if (nbpings > this.nbAuthors() && nbpings > this.nbRooms()) body += ` ${nbpings} times`;
		switch (this.nbAuthors()) {
		case 0:
			break;
		case 1:
			body += ` by ${this.pings[0].authorname}`;
			break;
		default:
			body += ` by ${this.nbAuthors()} users`;
		}
		if (this.nbRooms()>1) {
			body += ` in ${this.nbRooms()} rooms`;
		}
		return body;
	}
}

async function closeAllNotifications(){
	let currentNotifications = await registration.getNotifications();
	for (notification of currentNotifications) { // there should be one current at most
		log("closing notification", notification);
		notification.close();
	}
}

async function onPushEvent(){
	// Today web push events don't contain any payload, so we
	// must query the server to know why even we've been notified
	let resp = await fetch(base + "/json/pings");
	let data = await resp.json();
	// we look for already displayed notifications, to replace them
	let currentNotifications = await registration.getNotifications();
	let tag;
	let lastAbstract;
	for (notification of currentNotifications) { // there should be one current at most
		log("merging old notification", notification);
		tag = notification.tag;
		log('tag of current notification:', tag);
		if (notification.data && notification.data.pings) {
			lastAbstract = new PingsAbstract(notification.data.pings);
		}
		notification.close();
	}
	let pings = data.pings;
	// note that we *must* show a notification on every wp event, even when there's no ping,
	// or chrome makes a generic one for us
	if (!tag) tag = nextTag++;
	let abstract = new PingsAbstract(pings);
	// if renotify is true there's no sound or vibration
	let renotify = !!lastAbstract
		&& lastAbstract.nbRooms()==abstract.nbRooms()
		&& lastAbstract.nbAuthors()==abstract.nbAuthors();
	if (!pings.length) renotify = true; // it may happen. Don't ring in that case.
	log('renotify:', renotify);
	let icon = `${base}/static/M-192.png`;
	let badge = `${base}/static/M-192.png`;
	await self.registration.showNotification(abstract.title(), {
		body: abstract.body(),
		data,
		icon,
		badge,
		tag,
		renotify
	});
}

async function goToPage(url){
	let windows = await clients.matchAll({
		type: "window",
		includeUncontrolled: true
	});
	for (let window of windows) {
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
	event.waitUntil(onPushEvent());
});

self.addEventListener('notificationclose', function(event){
	log("dismissed notification:", event.notification);
});

self.addEventListener('notificationclick', function(event){
	let data = event.notification.data;
	if (!data || !data.pings) {
		log("abnormal notification", event.notification);
		return;
	}
	let url = base;
	if (data.pings.length) {
		let ping = data.pings[0]; // let's just choose the first one
		url = `${base}/${ping.r}#${ping.mid}`;
	}
	event.waitUntil(goToPage(url));
});

self.addEventListener("message", function(event){
	if (event.data=="new-chat") {
		closeAllNotifications();
	}
});
