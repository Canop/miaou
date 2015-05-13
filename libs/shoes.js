
// A shoe wraps a socket and is provided to controlers and plugins.
// It's kept in memory by the closures of the socket event handlers

var io, db, onSendMessagePlugins;
	
exports.configure = function(miaou){
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
	this.room;
	this.lastMessageTime;
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
	var	currentUserId = this.publicUser.id,
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
	for (var plugin of onSendMessagePlugins) {
		plugin.onSendMessage(this, m, sendFun);
	}
	sendFun('message', m);
}
Shoes.io = function(){
	return io;
}

// returns the socket of the passed user if he's in the same room
Shoes.userSocket = function(userIdOrName, includeWatchers) {
	var clients = io.sockets.adapter.rooms[this.room.id];
	for (var clientId in clients) {
		var socket = io.sockets.connected[clientId];
		if (socket && socket.publicUser && (socket.publicUser.id===userIdOrName||socket.publicUser.name===userIdOrName)) {
			return socket;
		}		
	}
	if (!includeWatchers) return;
	clients = io.sockets.adapter.rooms['w'+this.room.id];
	for (var clientId in clients) {
		var socket = io.sockets.connected[clientId];
		if (socket && socket.publicUser && (socket.publicUser.id===userIdOrName||socket.publicUser.name===userIdOrName)) {
			return socket;
		}		
	}
}
// to be used by bots, creates a message, store it in db and emit it to the room
Shoes.botMessage = function(bot, content){
	var shoe = this;
	this.db.on({content:content, author:bot.id, room:this.room.id, created:Date.now()/1000|0})
	.then(db.storeMessage)
	.then(function(m){
		m.authorname = bot.name;
		m.avs = bot.avatarsrc;
		m.avk = bot.avatarkey;
		m.bot = true;
		m.room = shoe.room.id;
		shoe.emitToRoom('message', m);
	}).finally(this.db.off);
}

// gives the ids of the rooms to which the user is currently connected (either directly or via a watch)
Shoes.userRooms = function(){
	var rooms = [], userId = this.publicUser.id,
		iorooms = io.sockets.adapter.rooms;
	for (var roomId in iorooms) {
		var m = roomId.match(/^w?(\d+)$/);
		if (!m) continue;
		var clients = iorooms[roomId];
		for (var clientId in clients) {
			var socket = io.sockets.connected[clientId];
			if (socket && socket.publicUser && socket.publicUser.id===userId) {
				rooms.push(+m[1]);
				break;
			}
		}	
	}
	return rooms;
}
