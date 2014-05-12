// we keep in memory an object, the video descriptor (how original), holding
//  - both usernames
//  - both shoes
//  - both accept ("on")

var Promise = require("bluebird"),
	cache = require('bounded-cache')(200);

function makeVD(shoe, message) {
	var match = message.content.match(/^!!video\s*@(\w[\w_\-\d]{2,})/);
	if (!match) throw  'Bad syntax. Use `!!video @somebody`';
	var vd = {
		usernames:[message.authorname, match[1]],
		shoes:[null, null],
		on: [false, false]
	};
	if (vd.usernames[0]===vd.usernames[1]) throw "You can't have a video chat with yourself (sorry)";
	cache.set(message.id, vd);
	return vd;
}

// returns a promise of an array
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

function onCommand(cmd, shoe, m){
	makeVD(shoe, m);
}

exports.onNewShoe = function(shoe){
	shoe.socket.on('video.ping', function(arg){ // sets the shoe that will be used to communicate with this user
		getVD(shoe, arg.mid);
	}).on('video.onoff', function(arg){ // arg.onoff must be a boolean
		getVD(shoe, arg.mid).spread(function(vd, index){
			vd.on[index] = arg.onoff;
		})
	}).on('video.msg', function(arg){ // pass the message to the other video chatter
		getVD(shoe, arg.mid).spread(function(vd, index){
			vd.shoes[+!index].emit('video.msg', arg);
		});
	});
}

exports.registerCommands = function(cb){
	cb('video', onCommand, "open a video chat. Type `!!video @somebody`");
}
