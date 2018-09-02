
const webPush = require("web-push");

const subscriptions = new Map; // username -> subscription

let	miaou,
	vapid;

exports.configure = function(_miaou){
	miaou = _miaou;
	vapid = miaou.conf("web-push", "VAPID") || {};
	if (!vapid.publicKey || !vapid.privateKey) {
		console.log("You must set the VAPID keys in Miaou config. You can use the following ones:");
		console.log(webPush.generateVAPIDKeys());
		return;
	}
	let email = miaou.conf("admin-email");
	if (!email) {
		console.log("admin-email must be set in Miaou config");
		return;
	}
	webPush.setVapidDetails(
		"mailto:"+email,
		vapid.publicKey,
		vapid.privateKey
	);
	return this;
}

exports.appGetVapidPublicKey = function(req, res){
	res.send(vapid.publicKey);
}

exports.appPostWebPushRegister = function(req, res){
	console.log("got web-push registration");
	res.sendStatus(201);
}

exports.sioWebPushRegister = function(subscription){
	console.log('register subscription:', subscription);
}

function notify(username, options){
	let subscription = subscriptions.get(username);
	if (!subscription) return console.log("no subscription found for", username);
	console.log("trying pushing something", username, options);
	webPush.sendNotification(
		subscription,
		null, // payload in web push events isn't currently supported by browsers
		{
			TTL: 60 // seconds
		}
	)
	.then(()=>{
		console.log(" -> ok");
	})
	.catch((err)=>{
		console.log(" -> failed:", err);
	});
}

exports.registerSubscription = function(user, subscription){
	console.log("register subscription for", user.name, ":", subscription);
	subscriptions.set(user.name, subscription);
}

function onNotifyCommand(ct){
	let match = ct.args.match(/^@(\w[\w_\-\d]{2,})(.*)/);
	if (!match) throw 'Bad syntax. Use `!!notify @some_other_user someText`';
	let username = match[1];
	let data = match[2].trim();
	notify(username, {data});
}

// temporary command to send a notification, for tests
exports.registerCommands = function(registerCommand){
	registerCommand({
		name: "notify",
		fun: onNotifyCommand,
		help: "TEST command" // FIXME remove this to make it "secret"
	});
}

exports.notifyPings = function(room, message, pings){
	for (let ping of pings) {
		notify(ping, {data:{
			r: {id:room.id, name:room.name},
			m: {id:message.id, an: message.authorname}
		}});
	}
}
