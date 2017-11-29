
// TODO stocker et emmettre aux arrivants à qui on n'a pas émis
const	auths = require('../../libs/auths.js'),
	bench = require("../../libs/bench.js"),
	Broadcast = require("./client-scripts/broadcast.shared.js"),
	ws = require('../../libs/ws.js');

var	langs;

exports.init = async function(miaou){
	langs = miaou.conf("langs");
}

// this is called both on initial call and on successive saves
async function onCommand(ct){
	if (!auths.isServerAdmin(ct.shoe.completeUser)) {
		throw new Error("Only a server admin can send a global message");
	}
	let b = new Broadcast(ct.message.content);
	if (!b.isValid()) {
		b.init(langs);
	}
	if (b.status==="sending") {
		if (!b.content) throw new Error("Can't broadcast an empty message");
		var bo = bench.start("broadcast dispatch");
		let bm = {
			content: b.content,
			created: Date.now()/1000|0
		};
		let langSet = new Set;
		for (var i=0; i<b.langs.length; i++) {
			if (b.langs[i].on) langSet.add(b.langs[i].lang);
		}
		for (let roomId of ws.roomIds()) {
			let room = await this.fetchRoom(roomId);
			if (!room) {
				continue;
			}
			if (!langSet.has(room.lang)) {
				continue;
			}
			console.log(`broadcasting to room ${room.name}`);
			ws.emitToRoom(roomId, 'broadcast.show', bm);
		}
		bo.end();
		b.status = "sent";
	}
	ct.message.content = b.md();
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name:'broadcast',
		fun:onCommand,
		help:"send a message to all rooms",
		detailedHelp:"Only server admins can do that"
	});
}

