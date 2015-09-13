"use strict";

const	apiversion = 48,
	nbMessagesAtLoad = 50, nbMessagesPerPage = 20, nbMessagesBeforeTarget = 5, nbMessagesAfterTarget = 5,
	Promise = require("bluebird"),
	path = require('path'),
	socketio = require('socket.io'),
	connect = require('connect'),
	socketWaitingApproval = [],
	auths = require('./auths.js'),
	commands = require('./commands.js'),
	pm  = require('./pm.js'),
	botMgr = require('./bots.js'),
	server = require('./server.js'),
	rooms = require('./rooms.js'),
	shoes = require('./shoes.js');

var	miaou,
	maxContentLength,
	minDelayBetweenMessages,
	clientConfig, // config sent to clients when they connect
	io, db, bot,
	plugins, onSendMessagePlugins, onNewMessagePlugins, onNewShoePlugins, onChangeMessagePlugins;

exports.configure = function(_miaou){
	miaou = _miaou;
	db = miaou.db;
	bot = miaou.bot;
	var config = miaou.config;
	maxContentLength = config.maxMessageContentSize || 500;
	minDelayBetweenMessages = config.minDelayBetweenMessages || 5000;
	plugins = (config.plugins||[]).map(function(n){ return require(path.resolve(__dirname, '..', n)) });
	onSendMessagePlugins = plugins.filter(function(p){ return p.onSendMessage });
	onNewMessagePlugins = plugins.filter(function(p){ return p.onNewMessage });
	onNewShoePlugins = plugins.filter(function(p){ return p.onNewShoe });
	onChangeMessagePlugins = plugins.filter(function(p){ return p.onChangeMessage });
	clientConfig = [
		'maxMessageContentSize','minDelayBetweenMessages',
		'maxAgeForMessageTotalDeletion','maxAgeForMessageEdition'
	].reduce(function(c,k){
		c[k] = config[k]; return c;
	}, {});
	commands.configure(miaou);
	return this;
}

exports.getOnSendMessagePlugins = function(){
	return onSendMessagePlugins;
}

// clones the message, removing all useless properties and the deleted content
// A typical not lighted message is like this :
//  {"id":629,"author":9,"authorname":"dystroy_lo","content":"A typical content in Miaou is very short.","created":1394132801,"changed":null,"pin":0,"star":0,"up":0,"down":0,"vote":null,"score":0}
// lighted :
//  {"id":629,"author":9,"authorname":"dystroy_lo","content":"A typical content in Miaou is very short.","created":1394132801}
var clean = exports.clean = function(src){
	var m = {};
	for (var k in src) {
		if (src[k]) m[k] = src[k];
	}
	if (m.content && /^!!deleted /.test(m.content)) {
		m.content = m.content.match(/^!!deleted (by:\d+ )?(on:\d+ )?/)[0];
	}
	return m;
}

// returns all the sockets of the given roomId
var roomSockets = exports.roomSockets = function(roomId){
	var	clients = io.sockets.adapter.rooms[roomId],
		sockets = [];
	for (var clientId in clients) {
		var s = io.sockets.connected[clientId];
		if (s) sockets.push(s); // TODO understand why s is often undefined
	}
	return sockets;
}

// TODO function to also emit an incr to the related w room (to watchers)
var emitToRoom = exports.emitToRoom = function(roomId, key, m){
	io.sockets.in(roomId).emit(key, clean(m));
}

// returns an array of all the Miaou rooms to which at least one user is connected
var roomIds = exports.roomIds = function(){
	return Object.keys(io.sockets.adapter.rooms).filter(function(n){ return n==+n });
}

var userSockets = exports.userSockets = function(userIdOrName) {
	var sockets = [];
	for (var clientId in io.sockets.connected) {
		var socket = io.sockets.connected[clientId];
		if (socket.publicUser && (socket.publicUser.id===userIdOrName||socket.publicUser.name===userIdOrName)) {
			sockets.push(socket);
		}
	}
	return sockets;
}

// returns the first found socket of the passed user (may be in another room)
var anyUserSocket = exports.anyUserSocket = function(userIdOrName) {
	for (var clientId in io.sockets.connected) {
		var socket = io.sockets.connected[clientId];
		if (socket.publicUser && (socket.publicUser.id===userIdOrName||socket.publicUser.name===userIdOrName)) {
			return socket;
		}
	}
}

// using a filtering function, picks some elements, removes them from the array,
//  executes a callback on each of them
// todo find a clearer name
function popon(arr, filter, act){
	var matches = [];
	for (var i=0; i<arr.length;) {
		if (filter(arr[i])) matches.push(arr.splice(i, 1)[0]);
		else i++;
	}
	if (act) matches.forEach(act);
}

// closes all sockets from a user in a given (sio) room
exports.throwOut = function(userId, roomId, text){
	var clients = io.sockets.adapter.rooms[roomId];
	for (var clientId in clients) {
		var socket = io.sockets.connected[clientId];
		if (socket.publicUser && socket.publicUser.id===userId) {
			if (text) socket.emit('miaou.error', text);
			socket.disconnect('unauthorized');
		}
	}
}

// granted : true if it's an approval, false in other cases
exports.emitAccessRequestAnswer = function(roomId, userId, granted, message) {
	popon(socketWaitingApproval, function(o){
		return o.userId===userId && o.roomId===roomId
	}, function(o){
		o.socket.emit('request_outcome', {granted:granted, message:message})
	});
}

// fetch a page of messages in DB and send them to the shoe socket
function emitMessages(shoe, asc, N, c1, s1, c2, s2){
	return this.getMessages(shoe.room.id, shoe.publicUser.id, N, asc, c1, s1, c2, s2).then(function(messages){
		for (var i=0; i<messages.length; i++) {
			for (var j=0; j<onSendMessagePlugins.length; j++) {
				onSendMessagePlugins[j].onSendMessage(shoe, messages[i], shoe.emit);
			}
			miaou.pageBoxer.onSendMessage(shoe, messages[i], shoe.emit);
		}
		shoe.emit('messages', messages);
	});
}

// to be used by bots, creates a message, store it in db and emit it to the room
exports.botMessage = function(bot, roomId, content){
	if (!roomId) throw "missing room Id";
	db.on({content:content, author:bot.id, room:roomId, created:Date.now()/1000|0})
	.then(function(m){
		commands.onBotMessage(bot, m);
		return m;
	})
	.then(db.storeMessage)
	.then(function(m){
		m.authorname = bot.name;
		m.avs = bot.avatarsrc;
		m.avk = bot.avatarkey;
		m.bot = true;
		m.room = roomId;
		miaou.pageBoxer.onSendMessage(this, m, function(t,c){
			emitToRoom(roomId, t, c);	
		});
		emitToRoom(roomId, 'message', m);
	}).finally(db.off);
}

// builds an unpersonnalized message. This avoids requerying the DB for the user
//  (messages are normally sent with the vote of the user)
function messageWithoutUserVote(message){
	var clone = {};
	for (var key in message) {
		if (message[key]) clone[key] = key==='vote' ? '?' : message[key]; // a value '?' means for browser "keep the existing value"
	}
	return clone;
}

// handles the socket, whose life should be the same as the presence of the user in a room without reload.
// Implementation details : //  - we don't pick the room in the session because it may be incorrect when the user has opened tabs in
//     different rooms and there's a reconnect
//  - the socket join the sio room whose id is the id of the room (a number)
//     and a sio room for every watched room, with id 'w'+room.id
function handleUserInRoom(socket, completeUser){
	var	shoe = new shoes.Shoe(socket, completeUser),
		otherDialogRoomUser, // defined only in a dialog room
		memroom,
		watchset = new Set, // set of watched rooms ids (if any)
		welcomed = false, 
		lastmmisreply, lastmmisatleastfivelines,
		send;
	socket
	.on('autocompleteping', function(namestart){
		db.on()
		.then(function(){
			return this.usersStartingWith(namestart, shoe.room.id, 10);
		}).then(function(list){
			if (list.length) socket.emit('autocompleteping', list.map(function(item){ return item.name }));
		}).catch(function(err){ console.log('ERR in PM :', err) })
		.finally(db.off);
	})
	.on('ban', function(ban){
		auths.wsOnBan(shoe, ban);
	})
	.on('rm_ping', function(mid){ // remove the ping(s) related to that message and propagate to other sockets of same user
		db.on([mid, shoe.publicUser.id])
		.spread(db.deletePing)
		.then(function(){
			shoe.emitToAllSocketsOfUser('rm_ping', mid, true);
		}).finally(db.off);
	})
	.on('disconnect', function(){
		if (shoe.room) {
			if (welcomed) {
				console.log("watch raz on disconnect", shoe.room.name, shoe.publicUser.name);
				db.on([shoe.room.id, shoe.publicUser.id])
				.spread(db.watchRaz)
				.finally(db.off);
			}
			if (!shoe.userSocket(shoe.completeUser.id, true)) {
				socket.broadcast.to(shoe.room.id).emit('leave', shoe.publicUser);
				for (var wid of watchset) {
					socket.broadcast.to(wid).emit('leave', shoe.publicUser);
				}
			}
		} else {
			console.log(shoe.completeUser.name, "disconnected before entering a room");
		}
		popon(socketWaitingApproval, function(o){ return o.socket===socket });
	})
	.on('enter', function(roomId){
		var now = Date.now()/1000|0;
		socket.emit('set_enter_time', now); // time synchronization
		if (shoe.room && roomId==shoe.room.id){
			console.log('WARN : user already in room'); // how does that happen ?
			return;
		}
		socket.emit('apiversion', apiversion);
		send = function(v, m){
			io.sockets.in(roomId).emit(v, clean(m));
		}
		db.on()
		.then(function(){
			return rooms.mem.call(this, roomId);
		})
		.then(function(mr){
			memroom = mr;
			return [
				this.fetchRoomAndUserAuth(roomId, shoe.publicUser.id),
				this.getRoomUserActiveBan(roomId, shoe.publicUser.id)
			]
		})
		.spread(function(r, ban){
			if (r.private && !r.auth) {
				// FIXME don't fill the logs with those errors that can come very fast in case of pulling
				throw new Error('Unauthorized user'); 
			}
			if (ban) throw new Error('Banned user');
			r.path = server.roomPath(r);
			shoe.room = r;
			console.log(shoe.publicUser.name, 'enters room', shoe.room.id, ':', shoe.room.name);
			socket.emit('room', shoe.room).join(shoe.room.id);
			socket.emit('config', clientConfig);
			return emitMessages.call(this, shoe, false, nbMessagesAtLoad);
		}).then(function(){
			return [
				this.fetchUserPings(completeUser.id),
				this.listRecentUsers(shoe.room.id, 50)
			]
		}).spread(function(pings, recentUsers){
			if (pings.length) socket.emit('pings', pings);
			socket.broadcast.to(shoe.room.id).emit('enter', shoe.publicUser);
			for (var o of socketWaitingApproval) {
				if (o.roomId===shoe.room.id && o.ar) socket.emit('request', o.ar);
			}
			if (shoe.room.dialog) {
				for (var i=0; i<recentUsers.length; i++) {
					if (recentUsers[i].id!==shoe.publicUser.id) {
						otherDialogRoomUser = recentUsers[i];
						break;
					}
				}
			}
			socket.emit('notables', memroom.notables);
			socket.emit('server_commands', commands.commands);
			socket.emit('recent_users', recentUsers);
			socket.emit('welcome');
			welcomed = true;
			for (var s of roomSockets(shoe.room.id).concat(roomSockets('w'+shoe.room.id))) {
				socket.emit('enter', s.publicUser);
			}
			return this.deleteRoomPings(shoe.room.id, shoe.publicUser.id);
		}).catch(db.NoRowError, function(){
			shoe.error('Room not found');
		})
		.catch(function(err){
			shoe.error(err);
		}).finally(db.off)
	})
	.on('start_watch', function(){
		db.on(completeUser.id)
		.then(db.listUserWatches)
		.then(function(watches){
			// console.log("watches of user "+shoe.publicUser.name+":", watches);
			socket.emit('wat', watches);
			shoe.emitToAllSocketsOfUser('watch_raz', shoe.room.id);
			for (var w of watches) {
				if (w.id!==shoe.room.id) {
					socket.join('w'+w.id);
					io.sockets.in(w.id).emit('enter', shoe.publicUser);
				}
				watchset.add(w.id);
			}
			socket.emit('watch_started');
		})
		.catch(function(err){
			shoe.error(err);
		}).finally(db.off)		
	})
	.on('error', function(e){
		console.log('socket.io error:', e);
	})
	.on('get_around', function(data){
		db.on()
		.then(function(){
			return emitMessages.call(this, shoe, false, nbMessagesBeforeTarget+1, '<=', data.target)
		}).then(function(){
			return emitMessages.call(this, shoe, true, nbMessagesAfterTarget, '>', data.target)
		}).then(function(){
			socket.emit('go_to', data.target);
		}).finally(db.off);
	})
	.on('get_message', function(mid){
		db.on(+mid)
		.then(db.getMessage)
		.then(function(m){
			m.vote = '?';
			shoe.pluginTransformAndSend(m, function(v,m){
				shoe.emit(v, clean(m));
			});
		}).finally(db.off);
	})
	.on('get_newer', function(cmd){
		if (!shoe.room) return;
		db.on([shoe, true, nbMessagesPerPage, '>=', cmd.from, '<', cmd.until]).spread(emitMessages).finally(db.off);
	})
	.on('get_older', function(cmd){
		if (!shoe.room) return;
		db.on([shoe, false, nbMessagesPerPage, '<=', cmd.from, '>', cmd.until]).spread(emitMessages).finally(db.off);
	})
	.on('grant_access', function(userId){
		if (!shoe.room) return;
		if (!(shoe.room.auth==='admin'||shoe.room.auth==='own')) return;
		db.on(userId)
		.then(db.getUserById)
		.then(function(user){
			if (!user) throw 'User "'+userId+'" not found';
			return [user, this.getAuthLevel(shoe.room.id, user.id)]
		})
		.spread(function(user, authLevel){
			// TODO test bans 
			if (authLevel) throw "you can't grant access to this user, he has already access to the room";
			shoe.emitBotFlakeToRoom(bot, "*"+user.name+"* has been granted access by *"+shoe.publicUser.name+"*", shoe.room.id);
			return this.changeRights([
				{cmd:"insert_auth", user:user.id, auth:"write"}, {cmd:"delete_ar", user:user.id}
			], shoe.publicUser.id, shoe.room);
		}).then(function(){
			exports.emitAccessRequestAnswer(shoe.room.id, userId, true);			
		}).catch(function(e) {
			shoe.error(e);
		}).finally(db.off);
	})
	.on('hist', function(search){
		if (!shoe.room) return;
		db.on(shoe.room.id)
		.then(db.messageHistogram)
		.then(function(hist){
			return [
				hist,
				search.pattern ? this.messageHistogram(shoe.room.id, search.pattern, 'english') : null
			]
		}).spread(function(hist, shist){
			if (shist){
				for (var ih=0, ish=0; ish<shist.length; ish++) {
					var sh = shist[ish];
					while (hist[ih].d<sh.d) ih++;
					hist[ih].sn = sh.n;
					hist[ih].sm = sh.m;
				}
			}
			socket.emit('hist', {search:search, hist:hist});
		}).finally(db.off);
	})
	.on('message', function(message){
		if (!shoe.room) {
			console.log('no room. Asking client');
			return socket.emit('get_room', message);
		}
		message.content = message.content||"";
		if (typeof message.content !== "string" || !(message.id||message.content)) {
			console.log("invalid incoming message");
			return;
		}
		var	now = Date.now(),
			roomId = shoe.room.id, // kept in closure to avoid sending a message asynchronously to bad room
			seconds = now/1000|0,
			content = message.content.replace(/\s+$/,'');
		if (content.length>maxContentLength) {
			shoe.error('Message too big, consider posting a link instead', content);
			return;
		}
		if (now-shoe.lastMessageTime<minDelayBetweenMessages) {
			shoe.error("You're too fast (minimum delay between messages : "+minDelayBetweenMessages+" ms)", content);
			return;
		}
		shoe.lastMessageTime = now;
		var	u = shoe.publicUser,
			m = { content:content, author:u.id, authorname:u.name, room:shoe.room.id},
			isreply = /^\s*@\w[\w\-]{2,}#\d+/.test(content),
			commandTask;
		if (u.avk) {
			m.avk = u.avk;
			m.avs = u.avs;
		}
		if (message.id) {
			m.id = +message.id;
			m.changed = seconds;
			for (var p of onChangeMessagePlugins) {
				var error = p.onChangeMessage(shoe, m);
				if (error) { // we don't use trycatch for performance reasons
					return shoe.error(error, m.content);
				}
			}
		} else {
			m.created = seconds;
		}

		db.on().then(function(){
			if (otherDialogRoomUser) {
				var r = shoe.room;
				// we must ensure the other dialog room user is watching
				var otherUserSockets = userSockets(otherDialogRoomUser.id);
				if (otherUserSockets.length) {
					var otherUserRooms = Object.keys(otherUserSockets[0].adapter.rooms);
					var isAlreadyWatching = otherUserRooms.indexOf('w'+r.id)!==-1;
					console.log("isAlreadyWatching:",isAlreadyWatching);
					// FIXME it seems that isAlreadyWatching isn't always correct
					if (!isAlreadyWatching) {
						otherUserSockets.forEach(function(s){
							s.join('w'+r.id);
							s.emit('wat', [{id:r.id, name:r.name, private:r.private, dialog:r.dialog}]);
						});
						return this.insertWatch(r.id, otherDialogRoomUser.id);
					}
				} else {
					console.log("other dialog user not connected");
					return this.tryInsertWatch(r.id, otherDialogRoomUser.id);
				}
			}
		}).then(function(){
			return commands.onMessage.call(this, shoe, m);
		}).then(function(ct){
			commandTask = ct;
			return [
				commandTask.nostore ? m : this.storeMessage(m, commandTask.ignoreMaxAgeForEdition),
				commandTask
			]
		}).spread(function(m, commandTask){
			var pings = []; // names of pinged users that weren't in the room
			if (commandTask.silent) return pings;
			if (m.changed) m.vote = '?';
			for (var p of onSendMessagePlugins) {
				p.onSendMessage(this, m, send);
			}
			miaou.pageBoxer.onSendMessage(this, m, send);
			send('message', m);
			if (commandTask.replyContent) {
				var txt = commandTask.replyContent;
				if (m.id) txt = '@'+m.authorname+'#'+m.id+' '+txt;
				shoe[commandTask.replyAsFlake ? "emitBotFlakeToRoom" : "botMessage"](bot, txt);
			}
			io.sockets.in('w'+roomId).emit('watch_incr', roomId);
			if (m.content && m.id) {
				var r = /(?:^|\s)@(\w[\w\-]{2,})\b/g, ping;
				while ((ping=r.exec(m.content))){
					pings.push(ping[1]);
				}
				if (!(m.id<=memroom.lastMessageId)) {
					// not yet used, might allow less watch_raz
					memroom.lastMessageId = m.id;
				}
			}
			return pings;
		}).reduce(function(pings, ping){ // expanding special pings (i.e. @room)
			if (ping==='room') {
				if (!shoe.room.private && shoe.room.auth!=='admin' && shoe.room.auth!=='own') {
					shoe.error("Only an admin can ping @room in a public room");
					return pings;
				}
				return this.listRoomUsers(shoe.room.id).then(function(users){
					return pings.concat(users.map(function(u){ return u.name }));
				});
			} else if (ping==='here') {
				return roomSockets(shoe.room.id).concat(roomSockets('w'+shoe.room.id))
				.map(function(s){ return s.publicUser.name });
			}
			pings.push(ping.toLowerCase());
			return pings;
		}, []).reduce(function(pings, ping){ // removing duplicates
			if (!~pings.indexOf(ping)) pings.push(ping);
			return pings;
		}, []).then(function(pings){
			return pings
		}).filter(function(unsentping){
			if (botMgr.onPing(unsentping, shoe, m)) return false; // it's a bot
			if (shoe.userSocket(unsentping)) return false; // no need to ping
			if (!shoe.room.private) return true;
			// user isn't in the room, we check he can enter the room
			return this.getAuthLevelByUsername(shoe.room.id, unsentping).then(function(oauth){
				if (oauth) return true;
				if (commandTask.cmd) return commandTask.alwaysPing;
				shoe.error(unsentping+" has no right to this room and wasn't pinged"); // todo different message for no user
			});
		}).then(function(remainingpings){
			if (remainingpings.length) {
				for (var username of remainingpings) {
					// user can enter the room, we notify him with a cross-room ping in the other rooms
					for (var clientId in io.sockets.connected) {
						var socket = io.sockets.connected[clientId];
						if (socket && socket.publicUser && socket.publicUser.name===username) {
							socket.emit('pings', [{
								// TODO rename r to room in pings
								r:shoe.room.id, rname:shoe.room.name, mid:m.id,
								authorname:m.authorname, content:m.content
							}]);
						}
					}
				}
				return this.storePings(shoe.room.id, remainingpings, m.id);
			}
		}).catch(function(e) {
			shoe.error(e, m.content);
		}).finally(db.off)
	})
	.on('mod_delete', function(ids){
		if (!shoe.room) return;
		if (!(shoe.room.auth==='admin'||shoe.room.auth==='own')) return;
		db.on(ids)
		.map(db.getMessage)
		.map(function(m){
			var now = (Date.now()/1000|0);
			m.room = shoe.room.id; // to trigger a security exception if user tried to mod_delete a message of another room
			m.content = "!!deleted by:" + shoe.publicUser.id + ' on:'+ now + ' ' + m.content;
			return this.storeMessage(m, true)
		}).map(function(m){
			io.sockets.in(shoe.room.id).emit('message', clean(m));
		}).catch(function(err){
			shoe.error('error in mod_delete');
			console.log('error in mod_delete', err);
		}).finally(db.off);		
	})
	.on('pm', function(otherUserId){
		db.on(otherUserId)
		.then(function(){
			return pm.openPmRoom.call(this, shoe, otherUserId);
		}).finally(db.off);
	})
	.on('pre_request', function(request){ // not called from chat but from request.jade
		var roomId = request.room, publicUser = shoe.publicUser;
		console.log(publicUser.name + ' is on the request page for room ' + roomId);
		socketWaitingApproval.push({
			socket:socket, userId:publicUser.id, roomId:roomId
		});
	})
	.on('request', function(request){ // not called from chat but from request.jade
		var roomId = request.room, publicUser = shoe.publicUser;
		console.log(publicUser.name + ' requests access to room ' + roomId);
		db.on()
		.then(function(){ return this.deleteAccessRequests(roomId, publicUser.id) })
		.then(function(){ return this.insertAccessRequest(roomId, publicUser.id, (request.message||'').slice(0,200)) })
		.then(function(ar){
			ar.user = publicUser;
			socket.broadcast.to(roomId).emit('request', ar);
			popon(socketWaitingApproval, function(o){ return o.socket===socket }); // cleans the pre_request
			socketWaitingApproval.push({
				socket:socket, userId:publicUser.id, roomId:roomId, ar:ar
			});
		}).catch(function(err){ console.log(err) }) // well...
		.finally(db.off);
	})
	.on('search', function(search){
		if (!shoe.room) return;
		db.on([shoe.room.id, search.pattern, 'english', 50])
		.spread(db.search)
		.filter(function(m){ return !/^!!deleted /.test(m.content) })
		.map(clean)
		.then(function(results){
			socket.emit('found', {results:results, search:search});
		}).finally(db.off);
	})
	.on('unpin', function(mid){
		if (!shoe.room) return;
		if (!(shoe.room.auth==='admin'||shoe.room.auth==='own')) return;
		db.on([shoe.room.id, shoe.publicUser.id, mid])
		.spread(db.unpin)
		.then(function(updatedMessage){
			var lm = clean(updatedMessage);
			socket.emit('message', lm);
			socket.broadcast.to(shoe.room.id).emit('message', messageWithoutUserVote(lm));
			return rooms.updateNotables.call(this, memroom);
		})
		.catch(function(err){ console.log('ERR in vote handling:', err) })
		.finally(db.off);		
	})
	.on('unwat', function(roomId){
		console.log(shoe.publicUser.name+' unwatches '+roomId);
		db.on([roomId, shoe.publicUser.id])
		.spread(db.deleteWatch)
		.then(function(){
			if (roomId!==shoe.room.id) socket.leave('w'+roomId);
			var sockets = shoe.allSocketsOfUser();
			for (var s of sockets) {
				s.emit('unwat', roomId);
			}
			socket.broadcast.to(roomId).emit('leave', shoe.publicUser);
			watchset.delete(roomId);
		})
		.finally(db.off);
	})
	.on('vote', function(vote){
		var	changedMessageIsInNotables,
			updatedMessage,
			strIds = memroom.notables.map(function(m){ return m.id }).join(' ');
		if (!shoe.room) return;
		if (vote.level==='pin' && !(shoe.room.auth==='admin'||shoe.room.auth==='own')) return;
		db.on([shoe.room.id, shoe.publicUser.id, vote.mid, vote.level])
		.spread(db[vote.action==='add'?'addVote':'removeVote'])
		.then(function(um){ // TODO most often we don't need the message, don't query it
			updatedMessage = clean(um);
			changedMessageIsInNotables = false;
			for (var i=0; i<memroom.notables.length; i++) {
				if (memroom.notables[i].id===vote.mid) {
					changedMessageIsInNotables = true;
					break;
				}
			}
			return rooms.updateNotables.call(this, memroom);
		})
		.then(function(){
			shoe.emitToRoom('vote', {
				level: vote.level,
				mid: vote.mid,
				voter: shoe.publicUser.id,
				diff: vote.action==='add' ? 1 : -1
			});
			var notableIds = memroom.notables.map(function(m){ return m.id });
			if (notableIds.join(' ')!==strIds) {
				// list of notables has changed, we send it
				var notablesUpdate = { ids:notableIds };
				if (!changedMessageIsInNotables) {
					for (var i=0; i<memroom.notables.length; i++) {
						if (memroom.notables[i].id===updatedMessage.id) {
							// the voted message entered the notables, we should send it 
							// TODO useless if message is among the very recent ones (last page)
							notablesUpdate.m = updatedMessage;
							break;
						}
					}
				}
				shoe.emitToRoom('notableIds', notablesUpdate);
			}
		})
		.catch(function(err){ console.log('ERR in vote handling:', err) })
		.finally(db.off);
	})
	.on('wat', function(roomId){
		db.on([roomId, shoe.publicUser.id])
		.spread(db.insertWatch) // we don't check the authorization because it's checked at selection
		.then(function(){
			return this.fetchRoomAndUserAuth(roomId, shoe.publicUser.id);
		})
		.then(function(r){
			if (r.private && !r.auth) throw new Error('Unauthorized user');
			if (roomId!==shoe.room.id) socket.join('w'+roomId);
			watchset.add(roomId);
			var sockets = shoe.allSocketsOfUser();
			for (var s of sockets) {
				s.emit('wat', [{id:r.id, name:r.name, private:r.private, dialog:r.dialog}]);
			}
			socket.broadcast.to(roomId).emit('enter', shoe.publicUser);
		})
		.catch(function(err){
			shoe.error(err);
		})
		.finally(db.off);
	})
	.on('watch_raz', function(roomId){
		if (!shoe.room) return;
		if (!roomId) {
			roomId = shoe.room.id;
			console.log("watch raz salle courante");
		}
		console.log("watch raz", roomId, shoe.publicUser.name);
		shoe.emitToAllSocketsOfUser('watch_raz', roomId);
		db.on([roomId, shoe.publicUser.id])
		.spread(db.watchRaz)
		.finally(db.off);
	});

	for (let plugin of onNewShoePlugins) {
		plugin.onNewShoe(shoe);
	}

	socket.emit('ready');
}

exports.listen = function(server, sessionStore, cookieParser){
	io = miaou.io = socketio(server);
	shoes.configure(miaou);
	shoes.setOnSendMessagePlugins(onSendMessagePlugins);
	io.use(function(socket, next){
		cookieParser(socket.handshake, {}, function(err){
			if (err) {
				console.log("error in parsing cookie");
				return next(err);
			}
			if (!socket.handshake.signedCookies) {
				console.log("no secureCookies|signedCookies found");
				return next(new Error("no secureCookies found"));
			}
			sessionStore.get(socket.handshake.signedCookies["connect.sid"], function(err, session){
				socket.session = session;
				if (!err && !session) err = new Error('session not found');
				if (err) console.log('ERR in socket authentication :', err);
				next(err);
			});
		});
	});
	io.on('connect', function(socket){
		function die(err){
			console.log('ERR in socket handling', err);
			socket.emit('miaou.error', err.toString());
			socket.disconnect();
		}
		var session = socket.session;
		if (!session) return die('no session in socket - internal bug');
		var room = session.room;
		if (!room) return die("no room in socket's session");
		var userId = session.passport.user;
		if (!userId) return die("no authenticated user in socket's session");
		db.on(userId)
		.then(db.getUserById)
		.then(function(completeUser){
			handleUserInRoom(socket, completeUser);
		}).catch(die)
		.finally(db.off);
	});
}
