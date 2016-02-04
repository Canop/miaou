// handles !!pm and the pm button

const err = require('./err.js'),
	ws = require('./ws.js');

var bot, db;

exports.configure = function(miaou){
	bot = miaou.bot;
	db = miaou.db;
	return this;
}

// must be called with context being a db connection, returns a promise
var openPmRoom = exports.openPmRoom = function (shoe, otherUserId, otherUserName){
	if (!shoe.room) return;
	var lounge, otherUser;
	return (otherUserId ? this.getUserById(otherUserId) : this.getUserByName(otherUserName))
	.then(function(user){
		if (!user) throw err.client("User "+(otherUserId||otherUserName)+" not found");
		otherUser = user;
		return this.getLounge(shoe.completeUser, otherUser)
	})
	.then(function(r){
		lounge = r;
		return this.storeMessage({
			content:otherUser.name+' has been invited to join this private room.',
			author:shoe.publicUser.id, authorname:shoe.publicUser.name, 
			room:lounge.id,
			created:Date.now()/1000|0
		});
	})
	.then(function(m){
		var socket = shoe.userSocket(otherUser.id) || ws.anyUserSocket(otherUser.id);
		if (socket) {
			socket.emit('invitation', {room:lounge.id, byname:shoe.publicUser.name, message:m.id});
		} else {
			return this.storePing(lounge.id, otherUser.id, m.id);
		}
	})
	.then(function(){
		shoe.socket.emit('pm_room', lounge.id)
	})
	.catch(function(e){ return !e.isclient }, function(e){ console.log('ERR in PM :', e) }) // TODO don't catch and filter client message upstream
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name:"pm", fun:function(ct){
			var m = ct.args.match(/@([\w-]{3,})/);
			if (!m) throw "missing username in !!pm command";
			ct.silent = true;
			ct.nostore = true;
			return openPmRoom.call(this, ct.shoe, 0, m[1]);
		},
		help:"open a dialog room to discuss with a specific user. Usage : `!!pm @someuser`",
		filter:function(room){ return !room.dialog }	
	});
}
