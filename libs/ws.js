const	apiversion = 85,
	nbMessagesAtLoad = 50,
	nbMessagesPerPage = 15,
	nbMessagesBeforeTarget = 8,
	nbMessagesAfterTarget = 6,
	path = require('path'),
	socketio = require('socket.io'),
	socketWaitingApproval = [],
	auths = require('./auths.js'),
	bench = require('./bench.js'),
	commands = require('./commands.js'),
	pm  = require('./pm.js'),
	botMgr = require('./bots.js'),
	server = require('./server.js'),
	rooms = require('./rooms.js'),
	pageBoxer = require('./page-boxers.js'),
	langs = require('./langs.js'),
	shoes = require('./shoes.js');

var	miaou,
	maxContentLength,
	minDelayBetweenMessages,
	clientConfig, // config sent to clients when they connect
	io, db, bot,
	plugins,
	onSendMessagePlugins,
	onNewShoePlugins,
	onReceiveMessagePlugins;

exports.configure = function(_miaou){
	miaou = _miaou;
	db = miaou.db;
	bot = miaou.bot;
	var config = miaou.config;
	maxContentLength = config.maxMessageContentSize || 500;
	minDelayBetweenMessages = config.minDelayBetweenMessages || 5000;
	plugins = (config.plugins||[]).map(n => require(path.resolve(__dirname, '..', n)));
	onSendMessagePlugins = plugins.filter(p => p.onSendMessage );
	onNewShoePlugins = plugins.filter(p => p.onNewShoe );
	onReceiveMessagePlugins = plugins.filter(p => p.onReceiveMessage );
	clientConfig = [
		'maxMessageContentSize', 'minDelayBetweenMessages',
		'maxAgeForMessageTotalDeletion', 'maxAgeForMessageEdition'
	].reduce(function(c, k){
		c[k] = config[k]; return c;
	}, {});
	commands.configure(miaou);
	return this;
}

exports.getOnSendMessagePlugins = function(){
	return onSendMessagePlugins;
}

// clones the message, removing all useless properties and the deleted content
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
	var	ioroom = io.sockets.adapter.rooms[roomId],
		sockets = [];
	if (!ioroom) {
		console.log('no room in ws.roomSockets');
		return sockets;
	}
	for (var socketId in ioroom.sockets) {
		var s = io.sockets.connected[socketId];
		if (s) sockets.push(s); // TODO understand why s is often undefined
	}
	return sockets;
}

var emitToRoom = exports.emitToRoom = function(roomId, key, m){
	io.sockets.in(roomId).emit(key, clean(m));
}

// returns an array of all the Miaou rooms to which at least one user is connected
exports.roomIds = function(){
	return Object.keys(io.sockets.adapter.rooms).filter(n => n==+n );
}

exports.userSockets = function(userIdOrName){
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
exports.anyUserSocket = function(userIdOrName){
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
	var ioroom = io.sockets.adapter.rooms[roomId];
	if (!ioroom) {
		console.log('lost room in ws.throwOut');
		return;
	}
	for (var socketId in ioroom.sockets) {
		var socket = io.sockets.connected[socketId];
		if (socket && socket.publicUser && socket.publicUser.id===userId) {
			if (text) socket.emit('miaou.error', text);
			socket.disconnect('unauthorized');
		}
	}
}

// granted : true if it's an approval, false in other cases
exports.emitAccessRequestAnswer = function(roomId, userId, granted, message){
	popon(socketWaitingApproval, function(o){
		return o.userId===userId && o.roomId===roomId
	}, function(o){
		o.socket.emit('request_outcome', {granted:granted, message:message});
	});
	io.sockets.to(roomId).to('w'+roomId).emit('request_outcome', {
		room: roomId,
		granted: granted,
		message: message
	});
}

// fetch a page of messages in DB and send them to the shoe socket
function emitMessages(shoe, asc, N, c1, s1, c2, s2){
	return this.getMessages(shoe.room.id, shoe.publicUser.id, N, asc, c1, s1, c2, s2).then(function(messages){
		for (var i=0; i<messages.length; i++) {
			for (var j=0; j<onSendMessagePlugins.length; j++) {
				onSendMessagePlugins[j].onSendMessage(shoe, messages[i], shoe.emit);
			}
			pageBoxer.onSendMessage(shoe, messages[i], shoe.emit);
		}
		shoe.emit('messages', messages);
	});
}

// to be used by bots, creates a message, store it in db and emit it to the room
// There's a delay because most often this is used to answer a command and
// we don't want the answer to come first
// Note that this doesn't send pings
exports.botMessage = function(bot, roomId, content, cb){
	setTimeout(function(){
		db.on()
		.then(function(){
			return exports.botSendMessage(this, bot, roomId, content);
		})
		.then(function(m){
			if (cb) cb.call(this, m);
		})
		.finally(db.off);
	}, 300);
}

// to be used by bot, store a message in DB, sends it. Doesn't ping users.
// There's no delay.
// Asynchronously returns the sent message (with id).
exports.botSendMessage = async function(con, bot, roomId, content){
	if (!roomId) throw new Error("missing room Id");
	if (!bot) bot = miaou.bot;
	var message = {content, author:bot.id, authorname:bot.name, room:roomId, created:Date.now()/1000|0};
	await commands.onBotMessage.call(con, bot, message);
	message = await con.storeMessage(message);
	message.authorname = bot.name;
	message.avs = bot.avatarsrc;
	message.avk = bot.avatarkey;
	message.bot = true;
	message.room = roomId;
	pageBoxer.onSendMessage(con, message, function(t, c){
		emitToRoom(roomId, t, c);
	});
	var memroom = rooms.mem.call(con, roomId);
	if (!(message.id<=memroom.lastMessageId)) {
		memroom.lastMessageId = message.id;
	}
	emitToRoom(roomId, 'message', message);
	if (message.id) {
		io.sockets.in('w'+roomId).emit('watch_incr', {r:roomId, m:message.id, f:message.author});
	}
	return message;
}

exports.botReply = function(bot, message, txt, cb){
	let content = "@"+message.authorname;
	if (message.id) content += "#"+message.id;
	content += " " + txt;
	exports.botMessage(bot||miaou.bot, message.room, content, cb);
}

exports.botFlake= function(bot, roomId, content){
	io.sockets.in(roomId).emit('message', {
		author:bot.id, authorname:bot.name, avs:bot.avatarsrc, avk:bot.avatarkey,
		created:Date.now()/1000|0, bot:true, room:roomId, content:content
	});
}

// this simplified ping function isn't used for normal messages but for bots
// context of the call must be a connected db
exports.pingUser = function(room, username, mid, authorname, content){
	var promise;
	if (typeof room === "number") {
		promise = this.fetchRoom(room);
	} else {
		promise = Promise.resolve(room);
	}
	return promise.then(function(room){
		for (var clientId in io.sockets.connected) {
			var socket = io.sockets.connected[clientId];
			if (socket && socket.publicUser && socket.publicUser.name===username) {
				socket.emit('pings', [{
					r:room.id, rname:room.name, mid,
					authorname, content
				}]);
			}
		}
		return this.storePings(room.id, [username], mid);
	})
}

// builds an unpersonnalized message. This avoids requerying the DB for the user
//  (messages are normally sent with the vote of the user)
function messageWithoutUserVote(message){
	var clone = {};
	for (var key in message) {
		// a value '?' means for browser "keep the existing value"
		if (message[key]) clone[key] = key==='vote' ? '?' : message[key];
	}
	return clone;
}

// fix the search object, completing author if given authorname
// and ensuring no options goes against room search rights
// must be called with context being a connection
function fixSearchOptions(search, userId, room){
	search.roomId = room ? room.id : search.roomId;
	search.lang = langs.pgLang(room.lang);
	search.pageSize = 20;
	search.page = search.page>0 ? search.page : 0;
	if (search.starrer && search.starrer!==userId) {
		throw new Error("Unauthorized search");
	}
	return search;
}

// handles the socket, whose life should be the same as the presence of the user in a room
// Implementation details :
//  - we don't pick the room in the session because it may be incorrect when the user has opened tabs in
//     different rooms and there's a reconnect
//  - the socket join the sio room whose id is the id of the room (a number)
//     and a sio room for every watched room, with id 'w'+room.id
function handleUserInRoom(socket, completeUser){
	let	shoe = new shoes.Shoe(socket, completeUser),
		otherDialogRoomUser, // defined only in a dialog room
		memroom,
		watchset = new Set, // set of watched rooms ids (if any)
		routes = new Map,
		pendingEvent,
		userIP = socket.handshake.headers["x-forwarded-for"]||socket.request.connection.remoteAddress,
		welcomed = false;


	console.log(completeUser.name, "connects from IP", userIP);

	function send(v, m){
		io.sockets.in(shoe.room.id).emit(v, clean(m));
	}

	// maps an event-type to a callback, for all events
	// which need a room.
	// Can't be used for event types using a callback
	// The eventHandler must be a function taking
	//  - an argument sent by the client
	//  - a function which should be called on end
	function on(eventType, eventHandler){
		var wrapperHander = function(arg){
			if (!shoe.room) {
				if (!pendingEvent) {
					// in order not to flood the server, we accept only one pending event
					pendingEvent = { eventType, arg };
				}
				socket.emit("must_reenter");
				console.log("missing room on " + eventType + ", emitting must_reenter");
				return;
			}
			var bo = bench.start("ws / " + eventType);
			eventHandler(arg, bo.end.bind(bo));
		}
		routes.set(eventType, wrapperHander);
		socket.on(eventType, wrapperHander);
	}

	//-----------------
	// special event handlers
	// (either allow no route to be set, or are callback based)

	socket
	.on('completeusername', function(query, cb){
		if (!shoe.room || !query.start) return;
		db.on()
		.then(function(){
			return this.usersStartingWith(query.start, shoe.room.id, 10);
		}).then(function(list){
			if (query.roomAuthors) list = list.filter(r=>r.lir);
			cb(list.map(item => item.name));
		})
		.catch(err => console.log('ERR in PM :', err))
		.finally(db.off);
	})
	.on('disconnect', function(){
		if (shoe.room) {
			if (welcomed && memroom) {
				db.on([shoe.room.id, shoe.publicUser.id, memroom.lastMessageId])
				.spread(db.updateWatch)
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
		popon(socketWaitingApproval, o => o.socket===socket );
	})
	.on('enter', function(entry){
		var	op = bench.start("Room Entry"),
			now = Date.now()/1000|0;
		socket.emit('set_enter_time', now); // time synchronization
		if (typeof entry !== "object") {
			entry = { roomId: +entry };
		}
		// console.log(entry.nbEntries ? "RE-ENTRY" : "Entry", shoe.publicUser.name, entry);
		if (!entry.roomId) {
			console.log("WARN : user enters no room");
			return;
		}
		if (shoe.room && entry.roomId==shoe.room.id) {
			console.log('WARN : user already in room'); // how does that happen ?
			return;
		}
		socket.emit('apiversion', apiversion);
		db.on()
		.then(function(){
			if (entry.tzoffset>=-720 && entry.tzoffset<=840) {
				if (entry.tzoffset != shoe.publicUser.tzoffset) {
					shoe.publicUser.tzoffset = shoe.completeUser.tzoffset = entry.tzoffset;
					console.log("new tzoffset", shoe.publicUser);
					return this.updateUserTzoffset(shoe.publicUser);
				}
			} else {
				console.log("invalid time zone offset:", shoe.publicUser.name, entry);
			}
		})
		.then(function(){
			return rooms.mem.call(this, entry.roomId);
		})
		.then(function(mr){
			memroom = mr;
			return [
				this.fetchRoomAndUserAuth(entry.roomId, shoe.publicUser.id),
				this.getRoomUserActiveBan(entry.roomId, shoe.publicUser.id)
			]
		})
		.spread(function(r, ban){
			if (r.private && !r.auth) {
				throw new Error('Unauthorized user');
			}
			if (ban) throw new Error('Banned user');
			r.path = server.roomPath(r);
			shoe.room = r;
			socket.emit('room', shoe.room).join(shoe.room.id);
			socket.emit('config', clientConfig);
			return emitMessages.call(this, shoe, false, nbMessagesAtLoad);
		}).then(function(){
			for (let plugin of onNewShoePlugins) {
				plugin.onNewShoe(shoe);
			}
		}).then(function(){
			return [
				this.fetchUserPings(completeUser.id, entry.lastMessageSeen),
				this.listRecentUsers(shoe.room.id, 50),
			]
		}).spread(function(pings, recentUsers){
			if (pings.length) socket.emit('pings', pings);
			socket.broadcast.to(shoe.room.id).emit('enter', shoe.publicUser);
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
			for (var s of roomSockets(shoe.room.id)) {
				socket.emit('enter', s.publicUser);
			}
			if (pings.length) return this.deleteRoomPings(shoe.room.id, shoe.publicUser.id);
		}).then(function(){
			if (!(shoe.room.auth==='admin'||shoe.room.auth==='own')) return;
			return this.listOpenAccessRequests(shoe.room.id)
			.then(function(accessRequests){
				accessRequests = accessRequests.slice(-5); // limit the number of notifications
				for (var j=accessRequests.length; j--;) {
					socket.emit('request', accessRequests[j]);
				}
			});
		}).then(function(){
			if (pendingEvent) {
				var pe = pendingEvent;
				console.log('pendingEvent:', pendingEvent);
				pendingEvent = null;
				routes.get(pe.eventType)(pe.arg);
			}
			op.end();
		}).catch(db.NoRowError, function(){
			shoe.error('Room not found');
		}).catch(function(err){
			shoe.error(err);
		}).finally(db.off)
	})
	.on('pre_request', function(request){ // not called from chat but from request.pug
		var roomId = request.room, publicUser = shoe.publicUser;
		console.log(publicUser.name + ' is on the request page for room ' + roomId);
		socketWaitingApproval.push({
			socket:socket, userId:publicUser.id, roomId:roomId
		});
	})
	.on('request', function(request){ // not called from chat but from request.pug
		var roomId = request.room, publicUser = shoe.publicUser;
		var bo = bench.start("ws / request access");
		console.log(publicUser.name + ' requests access to room ' + roomId);
		db.on()
		.then(function(){
			return this.deleteAccessRequests(roomId, publicUser.id)
		})
		.then(function(){
			return this.insertAccessRequest(roomId, publicUser.id, (request.message||'').slice(0, 200))
		})
		.then(function(ar){
			ar.user = publicUser;
			socket.broadcast.to(roomId).to('w'+roomId).emit('request', ar);
			popon(socketWaitingApproval, o => o.socket===socket ); // cleans the pre_request
			socketWaitingApproval.push({
				socket:socket, userId:publicUser.id, roomId:roomId, ar:ar
			});
			bo.end();
		})
		.catch(err => console.log(err)) // well...
		.finally(db.off);
	})
	.on('error', function(e){
		console.log('socket.io error:', e);
	});

	//-----------------
	// standard event handlers

	on('ban', function(ban, done){
		console.log('ban event', ban);
		auths.wsOnBan(shoe, ban);
		done();
	});

	on('get_after_time', function(data, done){
		var	mid,
			search = data.search || {};
		search.minCreated = data.minCreated;
		db.on([search, shoe.publicUser.id, shoe.room])
		.spread(fixSearchOptions)
		.then(db.searchFirstId)
		.then(function(row){
			mid = row.mid;
			return emitMessages.call(this, shoe, false, nbMessagesBeforeTarget, '<=', mid)
		}).then(function(){
			return emitMessages.call(this, shoe, true, nbMessagesAfterTarget, '>', mid)
		})
		.then(function(){
			socket.emit('go_to', mid);
			done();
		})
		.finally(db.off);
	});

	on('get_around', function(data, done){
		db.on()
		.then(function(){
			return emitMessages.call(this, shoe, false, nbMessagesBeforeTarget+1, '<=', data.target)
		}).then(function(){
			return emitMessages.call(this, shoe, true, nbMessagesAfterTarget, '>', data.target)
		}).then(function(){
			socket.emit('go_to', data.target);
			done();
		}).finally(db.off);
	});

	on('get_message', function(mid, done){
		db.on(+mid)
		.then(db.getMessage)
		.then(function(m){
			m.vote = '?';
			shoe.pluginTransformAndSend(m, function(v, m){
				shoe.emit(v, clean(m));
			});
			done();
		}).finally(db.off);
	});

	on('get_newer', function(cmd, done){
		db.on([shoe, true, nbMessagesPerPage, '>=', cmd.from, '<', cmd.until])
		.spread(emitMessages)
		.then(done)
		.finally(db.off);
	});

	on('get_older', function(cmd, done){
		if (!shoe.room) return;
		db.on([shoe, false, nbMessagesPerPage, '<=', cmd.from, '>', cmd.until])
		.spread(emitMessages)
		.then(done)
		.finally(db.off);
	});

	on('grant_access', function(grant, done){ // grant: {user:{id,name}, pingId, pingContent}
		if (!(shoe.room.auth==='admin'||shoe.room.auth==='own')) return;
		db.on(grant.user.id)
		.then(db.getUserById)
		.then(function(user){
			if (!user) throw 'User "'+grant.userId+'" not found';
			return [user, this.getAuthLevel(shoe.room.id, user.id)]
		})
		.spread(function(user, authLevel){
			if (authLevel) throw "you can't grant access to this user, he has already access to the room";
			let text = "@"+user.name+" has been granted access by @"+shoe.publicUser.name;
			shoe.emitBotFlakeToRoom(bot, text, shoe.room.id);
			return this.changeRights([
				{cmd:"insert_auth", user:user.id, auth:"write"}, {cmd:"delete_ar", user:user.id}
			], shoe.publicUser.id, shoe.room);
		}).then(function(){
			exports.emitAccessRequestAnswer(shoe.room.id, grant.user.id, true);
			if (grant.pingId) {
				exports.pingUser.call(
					this, shoe.room,
					grant.user.name, grant.pingId, shoe.publicUser.name, grant.pingContent
				);
			}
			done();
		}).catch(function(e){
			shoe.error(e);
		}).finally(db.off);
	});

	on('hist', function(search, done){ // request for histogram data
		db.on()
		.then(function(s){
			var r = [this.rawHistogram(shoe.room.id)];
			if (search) {
				search = fixSearchOptions(search, shoe.publicUser.id, shoe.room);
				r.push(this.searchHistogram(search));
			}
			return r;
		}).spread(function(hist, shist){
			if (shist) {
				for (var ih=0, ish=0; ish<shist.length; ish++) {
					var sh = shist[ish];
					while (hist[ih].d<sh.d) ih++;
					hist[ih].sn = sh.n;
				}
			}
			socket.emit('hist', {search:search, hist:hist});
			done();
		}).finally(db.off);
	});

	on('message', function(message, done){
		message.content = message.content||"";
		if (typeof message.content !== "string" || !(message.id||message.content)) {
			console.log("invalid incoming message");
			return;
		}
		var	now = Date.now(),
			roomId = shoe.room.id, // kept in closure to avoid sending a message asynchronously to bad room
			seconds = now/1000|0,
			content = message.content.replace(/\s+$/, '');
		if (content.length>maxContentLength) {
			shoe.error('Message too big, consider posting a link instead', content);
			return;
		}
		if (now-shoe.lastMessageTime<minDelayBetweenMessages) {
			shoe.error(
				"You're too fast (minimum delay between messages : "+minDelayBetweenMessages+" ms)",
				content
			);
			return;
		}
		shoe.lastMessageTime = now;
		var	u = shoe.publicUser,
			m = { content:content, author:u.id, authorname:u.name, room:shoe.room.id},
			commandTask;
		if (u.avk) {
			m.avk = u.avk;
			m.avs = u.avs;
		}
		if (message.id) {
			m.id = +message.id;
			m.changed = seconds;
		} else {
			m.created = seconds;
		}
		for (let i=0; i<onReceiveMessagePlugins.length; i++) {
			var error = onReceiveMessagePlugins[i].onReceiveMessage(shoe, m);
			if (error) { // we don't use trycatch for performance reasons
				return shoe.error(error, m.content);
			}
		}

		db.on()
		.then(function(){
			if (otherDialogRoomUser) {
				return this.tryInsertWatch(shoe.room.id, otherDialogRoomUser.id)
				.then(inserted=>{
					if (inserted) {
						exports.userSockets(otherDialogRoomUser.id).forEach(s=>{
							s.emit('wat', [{
								id: shoe.room.id,
								name: shoe.room.name,
								private: true,
								dialog: true,
								auth: 'own',
								nbunseen: 1,
								nbrequests: 0,
								last_seen: inserted.last_seen
							}]);
						});
					}
				});
			}
		})
		.then(function(){
			return commands.onMessage.call(this, shoe, m);
		})
		.then(function(ct){
			commandTask = ct;
			return [
				commandTask.nostore && !m.id ? m : this.storeMessage(m, commandTask.ignoreMaxAgeForEdition),
				commandTask
			]
		})
		.spread(function(m, commandTask){
			var pings = []; // names of pinged users that weren't in the room
			if (commandTask.silent) return pings;
			if (m.changed) {
				if (m.score) {
					// we must update the notable cache
					for (let i=0; i<memroom.notables.length; i++) {
						if (memroom.notables[i].id===m.id) {
							memroom.notables[i] = clean(m);
							break;
						}
					}
				}
				m.vote = '?';
			}
			for (var p of onSendMessagePlugins) {
				p.onSendMessage(this, m, send);
			}
			pageBoxer.onSendMessage(this, m, send);
			send('message', m);
			if (commandTask.replyContent) {
				var txt = commandTask.replyContent;
				if (m.id) txt = '@'+m.authorname+'#'+m.id+' '+txt;
				var replyer = commandTask.replyer || bot;
				shoe[commandTask.replyAsFlake ? "emitBotFlakeToRoom" : "botMessage"](replyer, txt);
			}
			if (commandTask.withSavedMessage && m.id) {
				commandTask.withSavedMessage(shoe, m);
			}
			if (m.content && m.id) {
				if (m.id>memroom.lastMessageId) {
					io.sockets.in('w'+roomId).emit('watch_incr', {r:roomId, m:m.id, f:m.author});
				}
				var r = /(?:^|\s)@(\w[\w\-]{2,19})\b/g, ping;
				while ((ping=r.exec(m.content))) {
					pings.push(ping[1]);
				}
				if (!(m.id<=memroom.lastMessageId)) {
					memroom.lastMessageId = m.id;
				}
			}
			return pings;
		})
		.reduce(function(pings, ping){ // expanding special pings (i.e. @room)
			if (ping==='room') {
				if (!shoe.room.private && shoe.room.auth!=='admin' && shoe.room.auth!=='own') {
					shoe.error("Only an admin can ping @room in a public room");
					return pings;
				}
				return this.listRoomUsers(shoe.room.id).then(function(users){
					return pings.concat(users.map(u => u.name ));
				});
			} else if (ping==='here') {
				return roomSockets(shoe.room.id).concat(roomSockets('w'+shoe.room.id))
				.map(s => s.publicUser.name );
			}
			pings.push(ping.toLowerCase());
			return pings;
		}, [])
		.reduce(function(pings, ping){ // removing duplicates
			if (!~pings.indexOf(ping)) pings.push(ping);
			return pings;
		}, [])
		.filter(function(unsentping){
			if (botMgr.onPing(unsentping, shoe, m)) return false; // it's a bot
			if (shoe.userSocket(unsentping)) return false; // no need to ping
			if (!shoe.room.private) return true;
			// user isn't in the room, we check he can enter the room
			return this.getAuthLevelByUsername(shoe.room.id, unsentping).then(function(oauth){
				if (oauth) return true;
				if (commandTask.cmd) return commandTask.alwaysPing;
				// todo different message for no user
				shoe.error(unsentping+" has no right to this room and wasn't pinged");
			});
		})
		.then(function(remainingpings){
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
		})
		.then(function(){
			done()
		})
		.catch(function(e){
			shoe.error(e, m.content);
		})
		.finally(db.off)
	});

	on('mod_delete', function(ids, done){
		if (!shoe.room) return;
		if (!(shoe.room.auth==='admin'||shoe.room.auth==='own')) return;
		db.on(ids)
		.map(db.getMessage)
		.map(function(m){
			var now = (Date.now()/1000|0);
			// We fix the room in the message
			// to trigger a security exception if user tried
			// to mod_delete a message of another room
			m.room = shoe.room.id;
			m.content = "!!deleted by:" + shoe.publicUser.id + ' on:'+ now + ' ' + m.content;
			return this.storeMessage(m, true)
		})
		.map(function(m){
			io.sockets.in(shoe.room.id).emit('message', clean(m));
		})
		.then(done)
		.catch(function(err){
			shoe.error('error in mod_delete');
			console.log('error in mod_delete', err);
		})
		.finally(db.off);
	});

	on('pm', function(otherUserId, done){
		db.on(otherUserId)
		.then(function(){
			return pm.openPmRoom.call(this, shoe, otherUserId);
		})
		.then(done)
		.finally(db.off);
	});

	on('rm_ping', function(mid, done){
		// remove the ping(s) related to that message and propagate to other sockets of same user
		db.on([mid, shoe.publicUser.id])
		.spread(db.deletePing)
		.then(function(){
			shoe.emitToAllSocketsOfUser('rm_ping', mid, true);
			done();
		}).finally(db.off);
	});

	on('search', function(search, done){
		db.on([search, shoe.publicUser.id, shoe.room])
		.spread(fixSearchOptions)
		.then(db.search)
		.filter(m => !/^!!deleted /.test(m.content))
		.map(clean)
		.then(function(results){
			socket.emit('found', {results, search, mayHaveMore:results.length===search.pageSize});
			done();
		})
		.finally(db.off);
	});

	on('start_watch', function(_, done){
		db.on(completeUser.id)
		.then(db.listUserWatches)
		.then(function(watches){
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
			done();
		})
		.catch(function(err){
			shoe.error(err);
		}).finally(db.off)
	})

	on('unpin', function(mid, done){
		if (!(shoe.room.auth==='admin'||shoe.room.auth==='own')) return;
		db.on([shoe.room.id, shoe.publicUser.id, mid])
		.spread(db.unpin)
		.then(function(updatedMessage){
			var lm = clean(updatedMessage);
			socket.emit('message', lm);
			socket.broadcast.to(shoe.room.id).emit('message', messageWithoutUserVote(lm));
			return memroom.updateNotables(this);
		})
		.then(done)
		.catch(err => console.log('ERR in vote handling:', err))
		.finally(db.off);
	});

	on('unwat', function(roomId, done){
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
			done();
		})
		.finally(db.off);
	});

	on('vote', function(vote, done){
		var	changedMessageIsInNotables,
			updatedMessage,
			strIds = memroom.notables.map(m => m.id ).join(' ');
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
			return memroom.updateNotables(this);
		})
		.then(function(){
			shoe.emitToRoom('vote', {
				level: vote.level,
				mid: vote.mid,
				voter: shoe.publicUser.id,
				diff: vote.action==='add' ? 1 : -1
			});
			var notableIds = memroom.notables.map(m => m.id);
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
		.catch(err => {
			console.log('ERR in handling vote:', vote);
			console.log('err:', err);
		})
		.finally(function(){
			this.off();
			done();
		});
	});

	on('wat', function(roomId, done){
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
			done();
		})
		.catch(function(err){
			shoe.error(err);
		})
		.finally(db.off);
	});

	on('watch_raz', function(roomId, done){
		if (!roomId) {
			roomId = shoe.room.id;
		}
		shoe.emitToAllSocketsOfUser('watch_raz', roomId);
		db.on()
		.then(function(){
			return rooms.mem.call(this, roomId)
		})
		.then(function(mr){
			return this.updateWatch(roomId, shoe.publicUser.id, mr.lastMessageId);
		})
		.then(done)
		.finally(db.off);
	});

	socket.emit('ready'); // tells the client it can starts entering the room, everything's bound
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
