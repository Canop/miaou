
const webPush = require("web-push");

const subscriptionInfos = new Map; // cache (lowercased username -> {subscription,pings}|null)

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
async function getSubscriptionInfo(con, username){
	username = username.toLowerCase();
	if (subscriptionInfos.has(username)) { // might be null
		return subscriptionInfos.get(username);
	}
	let user = await con.getUserByName(username);
	if (!user) {
		console.log("getSubscription: user not found", username);
		return;
	}
	let info = await con.getWebPushSubscription(user.id, maxSubscriptionAge);
	subscriptionInfos.set(username, info||null);
	return info;
}

exports.appGetVapidPublicKey = function(req, res){
	res.send(vapid.publicKey);
}

// alert: boolean
async function notify(con, username, alert){
	let info = await getSubscriptionInfo(con, username);
	if (!info) return console.log("no subscription found for", username);
	if (!alert && !info.pings) {
		console.log(`${username} wants only alerts -> not notifying`);
		return;
	}
	console.log("trying pushing something", username);
	webPush.sendNotification(
		info.subscription,
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

exports.registerSubscription = async function(con, user, info){
	let username = user.name.toLowerCase();
	let cachedInfo = subscriptionInfos.get(username);
	if (
		cachedInfo &&
		cachedInfo.subscription==info.subscription &&
		cachedInfo.pings==info.pings
	) {
		console.log("subscription didn't change for", username);
		return;
	}
	console.log("register subscription for", username);
	subscriptionInfos.set(user.name.toLowerCase(), info);
	await con.deleteWebPushSubscription(user.id);
	await con.insertWebPushSubscription(user.id, info.subscription, info.pings);
}

exports.unregisterSubscription = async function(con, user){
	console.log("removing subscription for", user.name);
	subscriptionInfos.set(user.name.toLowerCase(), null);
	await con.deleteWebPushSubscription(user.id);
}

async function onAlertCommand(ct){
	let match = ct.args.match(/^@(\w[\w_\-\d]{2,})(.*)/);
	if (!match) throw 'Bad syntax. Use `!!alert @some_other_user`';
	let username = match[1];
	await notify(this, username, true);
}

// temporary command to send a notification, for tests
exports.registerCommands = function(registerCommand){
	registerCommand({
		name: "alert",
		fun: onAlertCommand,
		help: "send a webpush notification to a user who asked to be notified when offline but only on alerts"
	});
}

exports.notifyPings = async function(con, room, message, pings){
	for (let ping of pings) {
		await notify(con, ping, false);
	}
}
