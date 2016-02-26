// A shoe wraps a socket and is provided to controlers and plugins.
// It's kept in memory by the closures of the socket event handlers

var	miaou,
	io,
	db,
	auths = require('./auths.js'),
	ws = require('./ws.js'),
	onSendMessagePlugins;

exports.configure = function(_miaou){
	miaou = _miaou;
	io = miaou.io;
	db = miaou.db;
}

exports.setOnSendMessagePlugins = function(ps){
	onSendMessagePlugins = ps;
}

function Shoe(socket, completeUser){
	this.socket = socket;
	this.completeUser = completeUser;
	this.publicUser = {id:completeUser.id, name:completeUser.name};
	if (completeUser.avatarkey) {
		this.publicUser.avs = completeUser.avatarsrc;
		this.publicUser.avk = completeUser.avatarkey;
	}
	this.room = null; // will be set later
	this.lastMessageTime = 0;
	this.db = db;
	socket.publicUser = this.publicUser;
	this.emit = socket.emit.bind(socket);
}
var Shoes = Shoe.prototype;
exports.Shoe = Shoe;

Shoes.error = function(err, messageContent){
	console.log('Error for user', this.completeUser.name, 'in room', (this.room||{}).name);
	console.log(err.stack || err);
	this.socket.emit('miaou.error', {txt:err.toString(), mc:messageContent});
}
Shoes.emitToRoom = function(key, m){
	io.sockets.in(this.room.id).emit(key, m);
}
// emits something to all sockets of a given user. Returns the number of sockets
Shoes.emitToAllSocketsOfUser = function(key, args, onlyOtherSockets){
	let	currentUserId = this.publicUser.id,
		nbs = 0;
	for (var clientId in io.sockets.connected) {
		var socket = io.sockets.connected[clientId];
		if (onlyOtherSockets && socket === this.socket) continue;
		if (socket && socket.publicUser && socket.publicUser.id===currentUserId) {
			socket.emit(key, args);
			nbs++;
		}
	}
	return nbs;
}
Shoes.allSocketsOfUser = function(){
	var sockets = [];
	for (var clientId in io.sockets.connected) {
		var socket = io.sockets.connected[clientId];
		if (socket && socket.publicUser && socket.publicUser.id===this.publicUser.id) {
			sockets.push(socket);
		}
	}
	return sockets;
}
Shoes.emitBotFlakeToRoom = function(bot, content, roomId){
	io.sockets.in(roomId||this.room.id).emit('message', {
		author:bot.id, authorname:bot.name, avs:bot.avatarsrc, avk:bot.avatarkey,
		created:Date.now()/1000|0, bot:true, room:this.room.id, content:content
	});
}
Shoes.pluginTransformAndSend = function(m, sendFun){
	for (var i=0; i<onSendMessagePlugins.length; i++) {
		onSendMessagePlugins[i].onSendMessage(this, m, sendFun);
	}
	sendFun('message', m);
}
Shoes.io = function(){
	return io;
}
Shoes.checkAuth = function(requiredLevel){
	if (!auths.checkAtLeast(this.room.auth, requiredLevel)) {
		throw new Error("This action requires the " + requiredLevel + " right");
	}
}

// returns the socket of the passed user if he's in the same room
Shoes.userSocket = function(userIdOrName, includeWatchers){
	var ioroom = io.sockets.adapter.rooms[this.room.id];
	if (!ioroom) {
		console.log('lost room in shoe.userSocket');
		return;
	}
	for (let socketId in ioroom.sockets) {
		let socket = io.sockets.connected[socketId];
		if (socket && socket.publicUser && (socket.publicUser.id===userIdOrName||socket.publicUser.name===userIdOrName)) {
			return socket;
		}
	}
	if (!includeWatchers) return;
	ioroom = io.sockets.adapter.rooms['w'+this.room.id];
	if (!ioroom) {
		console.log('lost watch room in shoe.userSocket');
		return;
	}
	for (let socketId in ioroom.sockets) {
		let socket = io.sockets.connected[socketId];
		if (
			socket && socket.publicUser &&
			(socket.publicUser.id===userIdOrName||socket.publicUser.name===userIdOrName)
		) {
			return socket;
		}
	}
}
// to be used by bots, creates a message, store it in db and emit it to the room
Shoes.botMessage = function(bot, content){
	ws.botMessage(bot, this.room.id, content);
}

// gives the ids of the rooms to which the user is currently connected (either directly or via a watch)
Shoes.userRooms = function(){
	var	rooms = [],
		userId = this.publicUser.id,
		iorooms = io.sockets.adapter.rooms;
	for (var roomId in iorooms) {
		var m = roomId.match(/^w?(\d+)$/);
		if (!m) continue;
		var ioroom = iorooms[roomId];
		for (var socketId in ioroom.sockets) {
			var socket = io.sockets.connected[socketId];
			if (socket && socket.publicUser && socket.publicUser.id===userId) {
				rooms.push(+m[1]);
				break;
			}
		}
	}
	return rooms;
}
