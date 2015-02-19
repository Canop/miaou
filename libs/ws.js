"use strict";

const apiversion = 38,
	maxHiatusForMerge = 10, // in seconds
	nbMessagesAtLoad = 50, nbMessagesPerPage = 20, nbMessagesBeforeTarget = 5, nbMessagesAfterTarget = 5,
	Promise = require("bluebird"),
	path = require('path'),
	socketio = require('socket.io'),
	connect = require('connect'),
	socketWaitingApproval = [],
	auths = require('./auths.js'),
	commands = require('./commands.js'),
	pm  = require('./pm.js'),
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

// removes all useless properties from an object
// A typical not lighted message is like this :
//  {"id":629,"author":9,"authorname":"dystroy_lo","content":"A typical content in Miaou is very short.","created":1394132801,"changed":null,"pin":0,"star":0,"up":0,"down":0,"vote":null,"score":0}
// lighted :
//  {"id":629,"author":9,"authorname":"dystroy_lo","content":"A typical content in Miaou is very short.","created":1394132801}
// FIXME : this function might be slow and, more importantly, it makes the object slower to iterate (hash table mode)
//            (confirmed for the iteration : http://jsperf.com/lightenings)
//         Is the solution to clone the object ?
function lighten(obj){
	for (var k in obj) {
		if (!obj[k]) delete obj[k];
	}
	return obj;
}

var clean = exports.clean = function(m){
	lighten(m);
	if (m.content && /^!!deleted /.test(m.content)) {
		m.content = m.content.match(/^!!deleted (by:\d+ )?(on:\d+ )?/)[0];
	}
	return m;
}

// returns all the sockets of the given roomId
var roomSockets = exports.roomSockets = function(roomId){
	var clients = io.sockets.adapter.rooms[roomId],
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

var roomIds = exports.roomIds = function(){
	return Object.keys(io.sockets.adapter.rooms).filter(function(n){ return n==+n });
}

// returns the first found socket of the passed user (may be in another room)
exports.anyUserSocket = function(userIdOrName) {
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

function emitMessages(shoe, asc, N, c1, s1, c2, s2){
	return this.getMessages(shoe.room.id, shoe.publicUser.id, N, asc, c1, s1, c2, s2).then(function(messages){
		for (var i=0; i<messages.length; i++) {
			for (var j=0; j<onSendMessagePlugins.length; j++) {
				onSendMessagePlugins[j].onSendMessage(shoe, messages[i], shoe.emit);
			}
		}
		shoe.emit('messages', messages);
	});
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
// Implementation details :
//  - we don't pick the room in the session because it may be incorrect when the user has opened tabs in
//     different rooms and there's a reconnect
//  - the socket join the sio room whose id is the id of the room (a number)
//     and a sio room for every watched room, with id 'w'+room.id
function handleUserInRoom(socket, completeUser){
	var shoe = new shoes.Shoe(socket, completeUser),
		memroom,
		watchset = new Set, // set of watched rooms ids (if any)
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
		auths.wsOnBan(shoe, db, ban);
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
			if (r.private && !r.auth) throw new Error('Unauthorized user'); // FIXME don't fill the logs with those errors that can come very fast in case of pulling
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
			socket.emit('notables', memroom.notables);
			socket.emit('server_commands', commands.commands);
			socket.emit('recent_users', recentUsers);
			socket.emit('welcome');
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
			console.log("watches of user "+shoe.publicUser.name+":", watches);
			socket.emit('wat', watches);
			shoe.emitToAllSocketsOfUser('watch_raz', shoe.room.id);
			for (var w of watches) {
				if (w.id!==shoe.room.id) {
					socket.join('w'+w.id);
					io.sockets.in(w.id).emit('enter', shoe.publicUser);
				}
				watchset.add(w.id);
			}			
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
			if (!user) throw 'User "'+username+'" not found';
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
				var ih = 0, ish = 0;
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
		if (/^--[^-]/.test(content)) {
			var nomerge = true;
			content = content.replace(/^--\s*/, '');
		} else if (/^\+\+(?=\s*\S+)/.test(content)) {
			var domerge = true;
			content = content.replace(/^\+\+\s*/, '');
		}
		shoe.lastMessageTime = now;
		var	u = shoe.publicUser,
			m = { content:content, author:u.id, authorname:u.name, room:shoe.room.id},
			mm = memroom.mm, // eventual previous mergeable message
			isreply = /^\s*@\w[\w\-]{2,}#\d+/.test(content),
			merge = null; // null or the content to concatenate to a previous message
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
		db.on([shoe, m])
		.spread(commands.onMessage)
		.then(function(commandTask){
			var isatleastfivelines = /(\n.*?){4}/.test(m.content);
			if ( // let's see if the message can be merged with the previous one
				!nomerge
				&& !m.id // must not be already an edit
				&& !commandTask.cmd // a command message isn't mergeable
				&& !isreply // a replying message can't be merged into a previous one
				&& mm
				&& mm.author===m.author // must be by same author
				&& ( domerge || ( !lastmmisreply && !lastmmisatleastfivelines ) ) // can't normally merge with a reply or a long message
				&& ( domerge || mm.created+maxHiatusForMerge>seconds ) // must be recent or the new one having ++ 
				&& mm.content && mm.content.length+m.content.length<maxContentLength  // must be not too big
			) {
				merge = m.content;
				mm.content += '\n'+m.content;
				mm.created = seconds;
				lastmmisatleastfivelines = isatleastfivelines;
				return [this.storeMessage(mm, true), commandTask]
			}
			lastmmisreply = isreply;
			lastmmisatleastfivelines = isatleastfivelines;
			memroom.mm = commandTask.cmd || m.id ? null : m;
			return [commandTask.nostore ? m : this.storeMessage(m, commandTask.ignoreMaxAgeForEdition), commandTask]
		}).spread(function(m, commandTask){
			if (commandTask.silent) return;
			if (m.changed) m.vote = '?';
			for (var p of onSendMessagePlugins) {
				p.onSendMessage(this, m, send);
			}
			if (merge) send('merge', {id:m.id, add:merge, created:m.created});
			else send('message', m);
			if (commandTask.replyContent) {
				var txt = commandTask.replyContent;
				if (m.id) txt = '@'+m.authorname+'#'+m.id+' '+txt;
				shoe[commandTask.replyAsFlake ? "emitBotFlakeToRoom" : "botMessage"](bot, txt);
			}
			io.sockets.in('w'+roomId).emit('watch_incr', roomId);
			var txt = merge || m.content;
			if (txt && m.id) {
				var pings = txt.match(/@\w[\w\-]{2,}(\b|$)/g);
				if (pings) {
					pings = pings.map(function(s){ return s.slice(1) });
					var remainingpings = [];
					for (var username of pings) {
						if (shoe.userSocket(username)) return;
						// user isn't in the room, we notify him with a cross-room ping in the other rooms
						var pinged = false;
						for (var clientId in io.sockets.connected) {
							var socket = io.sockets.connected[clientId];
							if (socket && socket.publicUser && socket.publicUser.name===username) {
								socket.emit('pings', [{r:roomId, rname:shoe.room.name, mid:m.id}]);
								pinged = true;
							}
						}
						remainingpings.push(username);
					}
					if (remainingpings.length) return this.storePings(roomId, remainingpings, m.id);						
				}
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
		.map(function(m){ return lighten(m) })
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
		var changedMessageIsInNotables,
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
		.finally(db.off);
	})
	.on('watch_raz', function(){
		if (!shoe.room) return;
		shoe.emitToAllSocketsOfUser('watch_raz', shoe.room.id);
	});

	for (let plugin of onNewShoePlugins) {
		plugin.onNewShoe(shoe);
	}

	socket.emit('ready');
}

exports.listen = function(server, sessionStore, cookieParser){
	io = miaou.io = socketio(server);
	shoes.configure(miaou);
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
