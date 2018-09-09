
const webPush = require("web-push");

const subscriptions = new Map; // cache (lowercased username -> subscription|null)

let	miaou,
	vapid,
	maxSubscriptionAge = 15*24*60*60;

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

// return null when there's no subscription or if it's too old
async function getSubscription(con, username){
	username = username.toLowerCase();
	if (subscriptions.has(username)) { // might be null
		return subscriptions.get(username);
	}
	let user = await con.getUserByName(username);
	if (!user) {
		console.log("getSubscription: user not found", username);
		return;
	}
	let subscription = await con.getWebPushSubscription(user.id, maxSubscriptionAge);
	console.log('subscription from db:', subscription);
	subscriptions.set(username, subscription||null);
	return subscription;
}

exports.appGetVapidPublicKey = function(req, res){
	res.send(vapid.publicKey);
}

async function notify(con, username, options={}){
	let subscription = await getSubscription(con, username);
	if (!subscription) return console.log("no subscription found for", username);
	console.log("trying pushing something", username, options);
	webPush.sendNotification(
		subscription,
		null, // payload in web push events isn't currently supported by browsers
		{
			//TTL: 60 // seconds
		}
	)
	.then(()=>{
		console.log(" -> ok");
	})
	.catch((err)=>{
		console.log(" -> failed:", err);
	});
}

exports.registerSubscription = async function(con, user, subscription){
	let username = user.name.toLowerCase();
	if (subscriptions.get(username)==subscription) {
		console.log("subscription didn't change for", username);
		return;
	}
	console.log("register subscription for", username, ":", subscription);
	subscriptions.set(user.name.toLowerCase(), subscription);
	await con.deleteWebPushSubscription(user.id);
	await con.insertWebPushSubscription(user.id, subscription);
}

exports.unregisterSubscription = async function(con, user){
	console.log("removing subscription for", user.name);
	subscriptions.set(user.name.toLowerCase(), null);
	await con.deleteWebPushSubscription(user.id);
}

async function onAlertCommand(ct){
	let match = ct.args.match(/^@(\w[\w_\-\d]{2,})(.*)/);
	if (!match) throw 'Bad syntax. Use `!!alert @some_other_user someText`';
	let username = match[1];
	await notify(this, username);
}

// temporary command to send a notification, for tests
exports.registerCommands = function(registerCommand){
	registerCommand({
		name: "alert",
		fun: onAlertCommand,
		help: "TEST command" // FIXME remove this to make it "secret"
	});
}

exports.notifyPings = async function(con, room, message, pings){
	for (let ping of pings) {
		await notify(con, ping);
	}
}
