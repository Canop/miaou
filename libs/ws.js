var config,
	Promise = require("bluebird"),
	path = require('path'),
	maxContentLength,
	minDelayBetweenMessages,
	socketio = require('socket.io'),
	connect = require('connect'),
	cookie = require('express/node_modules/cookie'),
	parseSignedCookie = connect.utils.parseSignedCookie,
	io, db,
	maxAgeForNotableMessages = 60*24*60*60, // in seconds
	nbMessagesAtLoad = 50, nbMessagesPerPage = 20, nbMessagesBeforeTarget = 5, nbMessagesAfterTarget = 5,
	plugins, onSendMessagePlugins, onNewMessagePlugins, onNewShoePlugins,
	socketWaitingApproval = [],
	commands = require('./commands.js');

exports.configure = function(_config){
	config = _config;
	maxContentLength = config.maxMessageContentSize || 500;
	minDelayBetweenMessages = config.minDelayBetweenMessages || 5000;
	plugins = (config.plugins||[]).map(function(n){ return require(path.resolve(__dirname, '..', n)) });
	onSendMessagePlugins = plugins.filter(function(p){ return p.onSendMessage });
	onNewMessagePlugins = plugins.filter(function(p){ return p.onNewMessage });
	onNewShoePlugins = plugins.filter(function(p){ return p.onNewShoe });
	commands.configure(config);
	return this;
}

// removes all useless properties from an object
// A typical not lighted message is like this :
//  {"id":629,"author":9,"authorname":"dystroy_lo","content":"A typical content in Miaou is very short.","created":1394132801,"changed":null,"pin":0,"star":0,"up":0,"down":0,"vote":null,"score":0}
// lighted :
//  {"id":629,"author":9,"authorname":"dystroy_lo","content":"A typical content in Miaou is very short.","created":1394132801}
function lighten(obj) {
	for (var k in obj) {
		if (!obj[k]) delete obj[k];
	}
	return obj;
}

// A shoe embeds a socket and is provided to controlers and plugins.
// It's kept in memory by the closures of the socket event handlers
function Shoe(socket, completeUser){
	this.socket = socket;
	this.completeUser = completeUser;
	this.publicUser = {id:completeUser.id, name:completeUser.name};
	this.room;
	this.lastMessageTime;
	this.db = db; // to be used by plugins or called modules
	socket['publicUser'] = this.publicUser;
}
Shoe.prototype.error = function(err, messageContent){
	console.log('ERR', err, 'for user', this.completeUser.name, 'in room', (this.room||{}).name);
	this.socket.emit('error', {txt:err.toString(), mc:messageContent});
}
Shoe.prototype.emit = function(key, m){
	this.socket.emit(key, lighten(m));
}
Shoe.prototype.emitToRoom = function(key, m){
	io.sockets.in(this.room.id).emit(key, lighten(m));
}
Shoe.prototype.pluginTransformAndSend = function(m, sendFun){
	onSendMessagePlugins.forEach(function(plugin){
		plugin.onSendMessage(this, m, sendFun);
	}, this);
	sendFun('message', m);
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

// granted : true if it's an approval, false in other cases
exports.emitAccessRequestAnswer = function(roomId, userId, granted, message) {
	popon(socketWaitingApproval, function(o){
		return o.userId===userId && o.roomId===roomId
	}, function(o){
		o.socket.emit('request_outcome', {granted:granted, message:message})
	});
}

// emits messages before (not including) beforeId
//  If beforeId is 0, then we look for the last messages of the room
// This function must be called on a Con object
function emitMessagesBefore(shoe, beforeId, untilId, nbMessages){
	var nbSent = 0, oldestSent, resolver = Promise.defer();
	this.queryMessagesBefore(shoe.room.id, shoe.publicUser.id, nbMessages, beforeId, untilId).on('row', function(message){
		shoe.pluginTransformAndSend(message, function(v,m){
			shoe.emit(v, m);
		});
		nbSent++;
		if (!(message.id>oldestSent)) oldestSent = message.id;
	}).on('end', function(){
		if (nbSent===nbMessages) shoe.emit('has_older', oldestSent);
		resolver.resolve();
	});
	return resolver.promise.bind(this);
}

// emits messages after and including untilId
// This function must be called on a Con object
function emitMessagesAfter(shoe, fromId, untilId, nbMessages){
	var nbSent = 0, youngestSent, resolver = Promise.defer();
	this.queryMessagesAfter(shoe.room.id, shoe.publicUser.id, nbMessages, fromId, untilId).on('row', function(message){
		shoe.pluginTransformAndSend(message, function(v,m){
			shoe.emit(v, m);
		});
		nbSent++;
		if (!(message.id<youngestSent)) youngestSent = message.id;
	}).on('end', function(){
		if (nbSent===nbMessages) shoe.emit('has_newer', youngestSent);
		resolver.resolve();
	});
	return resolver.promise.bind(this);
}

// filters the passed clients sockets to return those whose publicUser
//  is the passed one. This function returns a promise as the search is asynchronous.
// Note : this looks horribly heavy just to find if a user is in a room
function userClients(clients, userIdOrName) {
	return clients.filter(function(s){
		var user = s['publicUser'];
		return u.id===userIdOrName || u.name===userIdOrName;
	});
}

// handles the socket, whose life should be the same as the presence of the user in a room without reload
// Implementation details :
//  - we don't pick the room in the session because it may be incorrect when the user has opened tabs in
//     different rooms and there's a reconnect
function handleUserInRoom(socket, completeUser){
	var shoe = new Shoe(socket, completeUser);

	socket.on('request', function(request){
		var roomId = request.room, publicUser = shoe.publicUser;
		console.log(publicUser.name + ' requests access to room ' + roomId);
		db.on()
		.then(function(){ return this.deleteAccessRequests(roomId, publicUser.id) })
		.then(function(){ return this.insertAccessRequest(roomId, publicUser.id, (request.message||'').slice(0,200)) })
		.then(function(ar){
			ar.user = publicUser;
			socket.broadcast.to(roomId).emit('request', ar);
			socketWaitingApproval.push({
				socket:socket, userId:publicUser.id, roomId:roomId, ar:ar
			});
		}).catch(function(err){ console.log(err) }) // well...
		.finally(db.off);
	}).on('clear_pings', function(lastPingTime){ // tells that pings in the room have been seen, and ask if there are pings in other rooms
		if (!shoe.room) return console.log('No room in clear_pings');
		db.on([shoe.room.id, shoe.publicUser.id])
		.spread(db.deletePings)
		.then(function(){
			return this.fetchUserPingRooms(shoe.publicUser.id, lastPingTime);
		}).then(function(pings){
			socket.emit('pings', pings);
		}).finally(db.off);
	}).on('enter', function(roomId){
		var now = Date.now()/1000|0;
		socket.emit('set_enter_time', now);
		if (shoe.room && roomId==shoe.room.id){
			console.log('WARN : user already in room'); // how does that happen ?
			return;
		}
		db.on([roomId, shoe.publicUser.id])
		.spread(db.fetchRoomAndUserAuth)
		.then(function(r){
			if (r.private && !r.auth) throw new Error('Unauthorized user');
			shoe.room = r;
			console.log(shoe.publicUser.name, 'enters room', shoe.room.id, ':', shoe.room.name);
			socket.emit('room', shoe.room).join(shoe.room.id);
			return emitMessagesBefore.call(this, shoe, null, null, nbMessagesAtLoad)
		}).then(function(){
			socket.broadcast.to(shoe.room.id).emit('enter', shoe.publicUser);
			socketWaitingApproval.forEach(function(o){
				if (o.roomId===shoe.room.id) socket.emit('request', o.ar);
			});
			return this.getNotableMessages(shoe.room.id, now-maxAgeForNotableMessages);
		}).then(function(messages){
			messages.forEach(function(m){ socket.emit('notable_message', lighten(m)) });
			socket.emit('server_commands', commands.commandDescriptions);
			socket.emit('welcome');
			io.sockets.clients(shoe.room.id).forEach(function(s){
				var user = s['publicUser'];
				if (!user) console.log('missing user on socket');
				else socket.emit('enter', user);
			});
			return this.deletePings(shoe.room.id, shoe.publicUser.id);
		}).catch(db.NoRowError, function(){
			shoe.error('Room not found');
		}).catch(function(err){
			shoe.error(err);
		}).finally(db.off)
	}).on('get_message', function(mid){
		db.on(+mid)
		.then(db.getMessage)
		.then(function(m){
				shoe.pluginTransformAndSend(m, function(v,m){
					shoe.emit(v, lighten(m));
				});
		}).finally(db.off);
	}).on('get_around', function(data){
		db.on()
		.then(function(){
			return emitMessagesBefore.call(this, shoe, data.target, data.olderPresent, nbMessagesBeforeTarget)
		}).then(function(){
			return emitMessagesAfter.call(this, shoe, data.target, data.newerPresent, nbMessagesAfterTarget)
		}).then(function(){
			socket.emit('go_to', data.target);
		}).finally(db.off);
	}).on('get_older', function(data){
		db.on()
		.then(function(){
			return emitMessagesBefore.call(this, shoe, data.before, data.olderPresent, nbMessagesPerPage)
		}).finally(db.off);
	}).on('get_newer', function(data){
		db.on()
		.then(function(){
			return emitMessagesAfter.call(this, shoe, data.after, data.newerPresent, nbMessagesPerPage)
		}).finally(db.off);
	}).on('message', function(message){
		if (!shoe.room) { // todo check this is useful and a complete enough solution
			console.log('no room. Asking client');
			return socket.emit('get_room', lighten(message));
		}
		message.content = message.content||"";
		if (typeof message.content !== "string" || !(message.id||message.content)) {
			console.log("invalid incoming message");
			return;
		}
		var now = Date.now(),
			roomId = shoe.room.id, // kept in closure to avoid sending a message asynchronously to bad room
			seconds = now/1000|0, content = message.content.replace(/\s+$/,'');
		if (content.length>maxContentLength) {
			shoe.error('Message too big, consider posting a link instead', content);
		} else if (now-shoe.lastMessageTime<minDelayBetweenMessages) {
			shoe.error("You're too fast (minimum delay between messages : "+minDelayBetweenMessages+" ms)", content);
		} else {
			shoe.lastMessageTime = now;
			var u = shoe.publicUser,
				m = { content:content, author:u.id, authorname:u.name, room:shoe.room.id};
			if (message.id) {
				m.id = +message.id;
				m.changed = seconds;
			} else {
				m.created = seconds;
			}
			db.on([shoe, m])
			.spread(commands.onMessage)
			.then(function(){ return this.storeMessage(m) })
			.then(function(m){
				if (m.changed) {
					m.vote = '?';
				}
				shoe.pluginTransformAndSend(m, function(v,m){
					io.sockets.in(roomId).emit(v, lighten(m));
				});
				if (m.content){
					var pings = m.content.match(/@\w[\w_\-\d]{2,}(\b|$)/g);
					if (pings) return this.storePings(roomId, pings.map(function(s){ return s.slice(1) }), m.id);
				}
			}).catch(function(e) {
				shoe.error(e, m.content);
			}).finally(db.off)
		}
	}).on('vote', function(vote){
		if (vote.level=='pin' && !(shoe.room.auth==='admin'||shoe.room.auth==='own')) return;
		db.on([shoe.room.id, shoe.publicUser.id, vote.message, vote.level])
		.spread(db[vote.action==='add'?'addVote':'removeVote'])
		.then(function(updatedMessage){
			socket.emit('message', updatedMessage);
			var clone = {};
			for (var key in updatedMessage) {
				if (updatedMessage[key]) clone[key] = key==='vote' ? '?' : updatedMessage[key]; // a value '?' means for browser "keep the existing value"
			}
			socket.broadcast.to(shoe.room.id).emit('message', clone);
		}).catch(function(err){ console.log('ERR in vote handling:', err) })
		.finally(db.off);
	}).on('search', function(search){
		if (!shoe.room) return;
		db.on([shoe.room.id, search.pattern, 'english', 20])
		.spread(db.search)
		.then(function(results){
			socket.emit('found', {results:results, search:search});
		}).finally(db.off);
	}).on('hist', function(search){
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
	}).on('pm', function(otherUserId){
		var lounge, otherUser, message;
		db.on(otherUserId)
		.then(db.getUserById)
		.then(function(user){
			otherUser = user;
			return this.getLounge(shoe.completeUser, otherUser)
		}).then(function(r){
			lounge = r;
			var content = otherUser.name+' has been invited to join this private room.',
				m = { content:content, author:shoe.publicUser.id, authorname:shoe.publicUser.name, room:lounge.id, created:Date.now()/1000|0 };
			return this.storeMessage(m);
		}).then(function(m){
			message = m;
			sockets = userClients(io.sockets.clients(shoe.room.id), otherUserId);
			if (sockets.length) {
				sockets.forEach(function(s){
					s.emit('invitation', {room:lounge.id, byname:shoe.publicUser.name, message:message.id});
				});
			} else {
				return this.storePing(lounge.id, otherUserId, message.id);
			}
		}).then(function(){
			socket.emit('pm_room', lounge.id)
		}).catch(function(err){ console.log('ERR in PM :', err) })
		.finally(db.off);
	}).on('autocompleteping', function(namestart){
		db.on()
		.then(function(){
			return this.usersStartingWith(namestart, shoe.room.id, 10);
		}).then(function(list){
			if (list.length) socket.emit('autocompleteping', list.map(function(item){ return item.name }));
		}).catch(function(err){ console.log('ERR in PM :', err) })
		.finally(db.off);
	}).on('disconnect', function(){ // todo : are we really assured to get this event which is used to clear things ?
		if (shoe.room) {
			console.log(shoe.completeUser.name, "leaves room", shoe.room.id, ':', shoe.room.name);
			socket.broadcast.to(shoe.room.id).emit('leave', shoe.publicUser);
		} else {
			console.log(shoe.completeUser.name, "disconnected before entering a room");
		}
		popon(socketWaitingApproval, function(o){ return o.socket===socket });
	}).on('error', function(e){
		console.log('socket.io error:', e);
	});

	onNewShoePlugins.forEach(function(plugin){
		plugin.onNewShoe(shoe);
	});

	socket.emit('ready');
}

exports.listen = function(server, sessionStore, cookieParser /* not used */, _db){
	db = _db;
	io = socketio(server);

	io.use(function(socket, next){
		socket.cookie = cookie.parse(socket.request.headers.cookie);
		if (!socket.cookie || !socket.cookie['connect.sid']) {
			return next(new Error('no cookie'));
		}
		var sessionId = parseSignedCookie(socket.cookie['connect.sid'], config.secret);
		sessionStore.get(sessionId, function(err, session){
			socket.session = session;
			if (!err && !session) err = new Error('session not found');
			if (err) console.log('ERR in socket authentication :', err);
			next(err);
		});
	});
	io.on('connect', function(socket){
		function die(err){
			console.log('ERR in socket handling', err);
			socket.emit('error', err.toString());
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
