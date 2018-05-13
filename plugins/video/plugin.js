// we keep in memory an object, the video descriptor (how original), holding
//  - both usernames
//  - both shoes

var	webRtcConfig,
	cache = require('bounded-cache')(200);

exports.init = function(miaou){
	webRtcConfig = miaou.conf("pluginConfig", "video", "webRTC") || {};
}

function makeVD(shoe, message){
	var match = message.content.match(/^(?:@\w[\w\-]{2,19}#?\d*\s+)?!!\w+\s*@(\w[\w_\-\d]{2,19})/);
	if (!match) throw  'Bad syntax. Use `!!video @somebody` or `!!audio @somebody`';
	var vd = {
		usernames:[message.authorname, match[1]],
		shoes:[null, null]
	};
	if (vd.usernames[0]===vd.usernames[1]) throw "You can't have a video or audio chat with yourself (sorry)";
	cache.set(message.id, vd);
	return vd;
}

// returns a promise of an array containing
//  - the video descriptor
//  - the index of the current user in vd.players (-1, 0 or 1)
// Sets a missing shoe whenever possible
async function getVD(shoe, mid){
	let vd = cache.get(mid);
	if (!vd) {
		await shoe.db.do(async function(con){
			let m = await con.getMessage(mid);
			vd = makeVD(shoe, m);
		});
	}
	var index = -1;
	if (vd.usernames[0]===shoe.publicUser.name) vd.shoes[index=0] = shoe;
	else if (vd.usernames[1]===shoe.publicUser.name) vd.shoes[index=1] = shoe;
	return [vd, index];
}

function onCommand(ct){
	makeVD(ct.shoe, ct.message);
}

exports.onNewShoe = function(shoe){
	shoe.socket.on('video.getConfig', function(arg){ // pass the message to the other video chatter
		shoe.socket.emit("video.setConfig", webRtcConfig);
	});
	shoe.socket.on('video.msg', async function(arg){ // pass the message to the other video chatter
		let [vd, index] = await getVD(shoe, arg.mid);
		let otherShoe = vd.shoes[+!index];
		if (otherShoe) otherShoe.emit('video.msg', arg);
	});
}

exports.registerCommands = function(cb){
	cb({name:'video', fun:onCommand, help:"open a video+audio chat. Type `!!video @somebody`"});
	cb({name:'audio', fun:onCommand, help:"open a audio chat. Type `!!audio @somebody`"});
}
