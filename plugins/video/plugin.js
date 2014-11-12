// we keep in memory an object, the video descriptor (how original), holding
//  - both usernames
//  - both shoes

var Promise = require("bluebird"),
	cache = require('bounded-cache')(200);

function makeVD(shoe, message) {
	var match = message.content.match(/^(?:@\w[\w\-]{2,}#?\d*\s+)?!!\w+\s*@(\w[\w_\-\d]{2,})/);
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
function getVD(shoe, mid) {
	var vd = cache.get(mid);
	return (
		vd
		? Promise.cast(vd)
		: shoe.db.on(mid).then(shoe.db.getMessage).then(function(m){
			return makeVD(shoe, m);
		}).finally(shoe.db.off)
	).then(function(vd){
		var index = -1;
		if (vd.usernames[0]===shoe.publicUser.name) vd.shoes[index=0] = shoe;
		else if (vd.usernames[1]===shoe.publicUser.name) vd.shoes[index=1] = shoe;
		return [vd, index];
	});
}

function onCommand(ct){
	makeVD(ct.shoe, ct.message);
}

exports.onNewShoe = function(shoe){
	shoe.socket.on('video.msg', function(arg){ // pass the message to the other video chatter
		getVD(shoe, arg.mid).spread(function(vd, index){
			var otherShoe = vd.shoes[+!index];
			if (otherShoe) otherShoe.emit('video.msg', arg);
		});
	});
}

exports.registerCommands = function(cb){
	cb({name:'video', fun:onCommand, help:"open a video+audio chat. Type `!!video @somebody`"});
	cb({name:'audio', fun:onCommand, help:"open a audio chat. Type `!!audio @somebody`"});
}
