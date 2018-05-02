
const	auths = require('../../libs/auths.js'),
	Broadcast = require("./client-scripts/broadcast.Broadcast.js"),
	ws = require('../../libs/ws.js');

let	langs;

exports.init = async function(miaou){
	langs = miaou.conf("langs");
}

// finds the users who should receive the broadcasted message
// we can't just display to rooms because we wouldn't broadcast the message
// to users not currently in a matching room but watching it
async function findUsers(con, tagSet, langSet){
	let roomIds = ws.watchedRoomIds();
	let userIds = new Set;
	console.log('roomIds:', roomIds);
	let nbRooms = 0;
	for (let roomId of roomIds) {
		let room = await con.fetchRoom(roomId);
		if (!room) continue;
		if (!langSet.has(room.lang)) continue;
		if (tagSet.size) {
			let ok = false;
			for (let tag of room.tags) {
				if (tagSet.has(tag)) {
					ok = true;
					break;
				}
			}
			if (!ok) continue;
		}
		nbRooms++;
		for (let user of ws.roomUsers(roomId)) {
			userIds.add(user.id);
		}
		for (let user of ws.roomUsers('w'+roomId)) {
			userIds.add(user.id);
		}
	}
	console.log("matching rooms:", nbRooms);
	console.log("users:", userIds.size);
	return userIds;
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
		let bm = {
			content: b.content,
			created: Date.now()/1000|0,
			author: ct.shoe.publicUser,
			room: ct.shoe.room,
			mid: ct.message.id
		};
		let langSet = new Set;
		for (let i=0; i<b.langs.length; i++) {
			if (b.langs[i].on) langSet.add(b.langs[i].lang);
		}
		let tagSet = new Set(b.tags);
		let nbEmits = 0;
		let userIds = await findUsers(this, tagSet, langSet);
		for (let userId of userIds) {
			console.log("broadcasting to user", userId);
			for (let socket of ws.userSockets(userId)) {
				nbEmits++;
				console.log("  =>");
				socket.emit("broadcast.show", bm);
			}
		}
		console.log('nbEmits:', nbEmits);
		b.status = `sent to ${userIds.size} users`;
		ct.end("send");
	} else {
		ct.end();
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

