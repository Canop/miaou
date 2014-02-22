var config = require('./config.json'),
	Promise = require("bluebird"),
	maxContentLength = config.maxMessageContentSize || 500,
	minDelayBetweenMessages = config.minDelayBetweenMessages || 5000,
	socketio = require('socket.io'),
	SessionSockets = require('session.socket.io'),
	io,
	maxAgeForNotableMessages = 60*24*60*60, // in seconds
	nbMessagesAtLoad = 50, nbMessagesPerPage = 20, nbMessagesBeforeTarget = 5, nbMessagesAfterTarget = 5,
	socketWaitingApproval = [];

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
exports.emitAccessRequestAnswer = function(roomId, userId, granted) {
	popon(socketWaitingApproval, function(o){
		return o.userId===userId && o.roomId===roomId
	}, function(o){
		o.socket.emit('request_outcome', granted)
	});
}

// emits messages before (not including) beforeId
//  If beforeId is 0, then we look for the last messages of the room
// This function must be called on a Con object
// TODO with promises, this function starts to be painful. I should probably refactor it away
function emitMessagesBefore(socket, roomId, userId, beforeId, untilId, nbMessages){
	var nbSent = 0, oldestSent, resolver = Promise.defer();
	this.queryMessagesBefore(roomId, userId, nbMessages, beforeId, untilId).on('row', function(message){
		socket.emit('message', message);
		nbSent++;
		if (!(message.id>oldestSent)) oldestSent = message.id;
	}).on('end', function(){
		if (nbSent===nbMessages) socket.emit('has_older', oldestSent);
		resolver.resolve();
	});
	return resolver.promise.bind(this);
}

// emits messages after and including untilId
// This function must be called on a Con object
function emitMessagesAfter(socket, roomId, userId, fromId, untilId, nbMessages){
	var nbSent = 0, youngestSent, resolver = Promise.defer();
	this.queryMessagesAfter(roomId, userId, nbMessages, fromId, untilId).on('row', function(message){
		socket.emit('message', message);
		nbSent++;
		if (!(message.id<youngestSent)) youngestSent = message.id;	
	}).on('end', function(){
		if (nbSent===nbMessages) socket.emit('has_newer', youngestSent);
		resolver.resolve();
	});
	return resolver.promise.bind(this);
}


// filters the passed clients sockets to return those whose publicUser
//  is the passed one. This function returns a promise as the search is asynchronous.
// Note : this looks horribly heavy just to find if a user is in a room
function userClients(clients, userIdOrName) {
	if (clients.length===0) return [];
	var found = [], n = 0, resolver = Promise.defer();
	console.log('+++start looking for ' + userIdOrName + ' among ' + clients.length + ' sockets');
	clients.forEach(function(s){
		n++;
		s.get('publicUser', function(err, u){
			if (err) console.log('missing user on socket', err);
			console.log(u.name, u.id===userIdOrName || u.name===userIdOrName);
			if (u.id===userIdOrName || u.name===userIdOrName) found.push(s);
			if (--n===0) resolver.resolve(found);
			console.log(n, 'go on');
		});
	});
	console.log('n:',n);
	return resolver.promise.bind(this);
}

// handles the socket, whose life should be the same as the presence of the user in a room without reload
// Implementation details :
//  - we don't pick the room in the session because it may be incorrect when the user has opened tabs in
//     different rooms and there's a reconnect
function handleUserInRoom(socket, completeUser, db){
	function error(err){
		console.log('ERR', err, 'for user', completeUser.name, 'in room', (room||{}).name);
		socket.emit('error', err.toString());
	}
	var room, lastMessageTime,
		publicUser = {id:completeUser.id, name:completeUser.name};
	console.log('starting handling new socket for', completeUser.name);
	socket.set('publicUser', publicUser);

	socket.on('request', function(roomId){
		console.log(publicUser.name + ' requests access to room ' + roomId);
		db.on()
		.then(function(){ return this.deleteAccessRequests(roomId, publicUser.id) })
		.then(function(){ return this.insertAccessRequest(roomId, publicUser.id) })
		.then(function(ar){
			ar.user = publicUser;
			socket.broadcast.to(roomId).emit('request', ar);
			socketWaitingApproval.push({
				socket:socket, userId:publicUser.id, roomId:roomId, ar:ar
			});			
		}).catch(function(err){ console.log(err) }) // well...
		.finally(db.off);
	}).on('clear_pings', function(lastPingTime, ack){ // tells that pings in the room have been seen, and ask if there are pings in other rooms
		if (!room) return console.log('No room in clear_pings');
		db.on([room.id, publicUser.id])
		.spread(db.deletePings)
		.then(function(){
			return this.fetchUserPingRooms(publicUser.id, lastPingTime);
		}).then(ack)
		.finally(db.off);
	}).on('enter', function(roomId, ack){
		console.log(publicUser.name, 'enters', roomId);
		var now = ~~(Date.now()/1000);
		if (ack) ack(now);
		db.on([roomId, publicUser.id])
		.spread(db.fetchRoomAndUserAuth)
		.then(function(r){
			if (r.private && !r.auth) throw new Error('Unauthorized user');
			room = r;
			socket.emit('room', room).join(room.id);
			var nbSent = 0, oldestSent, resolver = Promise.defer();
			return emitMessagesBefore.call(this, socket, room.id, publicUser.id, null, null, nbMessagesAtLoad)
		}).then(function(){
			socket.broadcast.to(room.id).emit('enter', publicUser);
			socketWaitingApproval.forEach(function(o){
				if (o.roomId===room.id) socket.emit('request', o.ar);
			});
			return this.getNotableMessages(room.id, now-maxAgeForNotableMessages);
		}).then(function(messages){
			messages.forEach(function(m){ socket.emit('notable_message', m) });
			socket.emit('welcome');
			io.sockets.clients(room.id).forEach(function(s){
				s.get('publicUser', function(err, u){
					if (err) console.log('missing user on socket', err);
					else socket.emit('enter', u);
				});
			});
			return this.deletePings(room.id, publicUser.id);
		}).catch(db.NoRowError, function(){
			error('Room not found');
		}).catch(function(err){
			error(err.toString());
		}).finally(db.off)
	}).on('get_around', function(data, ack){ 
		db.on()
		.then(function(){
			return emitMessagesBefore.call(this, socket, room.id, publicUser.id, data.target, data.olderPresent, nbMessagesBeforeTarget)
		}).then(function(){
			return emitMessagesAfter.call(this, socket, room.id, publicUser.id, data.target, data.newerPresent, nbMessagesAfterTarget)
		}).then(ack)
		.finally(db.off);
	}).on('get_older', function(data){
		db.on()
		.then(function(){
			return emitMessagesBefore.call(this, socket, room.id, publicUser.id, data.before, data.olderPresent, nbMessagesPerPage)
		}).finally(db.off);
	}).on('get_newer', function(data){
		db.on()
		.then(function(){
			return emitMessagesAfter.call(this, socket, room.id, publicUser.id, data.after, data.newerPresent, nbMessagesPerPage)
		}).finally(db.off);
	}).on('message', function(message){
		if (!room) {
			socket.emit('get_room', message);
			return;
		}
		var now = Date.now(), seconds = ~~(now/1000), content = message.content;
		if (content.length>maxContentLength) {
			error('Message too big, consider posting a link instead');
		} else if (now-lastMessageTime<minDelayBetweenMessages) {
			error("You're too fast (minimum delay between messages : "+minDelayBetweenMessages+" ms)");
		} else {
			lastMessageTime = now;
			var m = { content: content, author: publicUser.id, authorname: publicUser.name, room: room.id};
			if (message.id) {
				m.id = message.id;
				m.changed = seconds;			
			} else {
				m.created = seconds;				
			}
			db.on(m)
			.then(db.storeMessage)
			.then(function(m){
				if (m.changed) {
					m.authorname = publicUser.name;
					m.vote = '?';
				}
				io.sockets.in(room.id).emit('message', m);
				var pings = m.content.match(/@\w[\w_\-\d]{2,}(\b|$)/g);
				if (pings) return this.storePings(room.id, pings.map(function(s){ return s.slice(1) }), m.id);
			}).finally(db.off)
		}
	}).on('vote', function(vote){
		if (vote.level=='pin' && !(room.auth==='admin'||room.auth==='own')) return;
		db.on([room.id, publicUser.id, vote.message, vote.level])
		.spread(db[vote.action==='add'?'addVote':'removeVote'])
		.then(function(updatedMessage){
			socket.emit('message', updatedMessage);
			var clone = {};
			for (var key in updatedMessage) {
				clone[key] = key==='vote' ? '?' : updatedMessage[key]; // a value '?' means for browser "keep the existing value"
			}
			socket.broadcast.to(room.id).emit('message', clone);	
		}).catch(function(err){ console.log('ERR in vote handling:', err) })		
		.finally(db.off);
	}).on('search', function(search, reply){
		db.on([room.id, search.pattern, 'english', 20])
		.spread(db.search)
		.then(function(results){
			reply(results);
		}).finally(db.off);
	}).on('hist', function(search, reply){
		if (!room) return reply([]);
		db.on(room.id)
		.then(db.messageHistogram)
		.then(function(hist){
			return [
				hist,
				search.pattern ? this.messageHistogram(room.id, search.pattern, 'english') : null
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
			reply(hist);
		}).finally(db.off);
	}).on('pm', function(otherUserId, reply){
		var lounge, otherUser, message;
		db.on(otherUserId)
		.then(db.getUserById)
		.then(function(user){
			otherUser = user;
			return this.getOrCreatePmRoom(completeUser, otherUser)
		}).then(function(r){
			lounge = r;
			var content = otherUser.name+' has been invited to join this private room.',
				m = { content:content, author:publicUser.id, authorname:publicUser.name, room:lounge.id, created:~~(Date.now()/1000) };
			return this.storeMessage(m);
		}).then(function(m){
			message = m;
			return userClients.call(this, io.sockets.clients(room.id), otherUserId);
		}).then(function(sockets){
			if (sockets.length) {
				sockets.forEach(function(s){
					s.emit('invitation', {room:lounge.id, byname:publicUser.name, message:message.id});
				});
			} else {
				return this.storePing(lounge.id, otherUserId, message.id);
			}
		}).then(function(){
			reply(lounge.id)
		}).catch(function(err){ console.log('ERR in PM :', err) })	
		.finally(db.off);
	}).on('disconnect', function(){ // todo : are we really assured to get this event which is used to clear things ?
		console.log(completeUser.name, "disconnected");
		if (room) socket.broadcast.to(room.id).emit('leave', publicUser);
		popon(socketWaitingApproval, function(o){ return o.socket===socket });
	});
	
	socket.emit('ready');
}

exports.listen = function(server, sessionStore, cookieParser, db){
	io = socketio.listen(server);
	io.set('log level', 1);
	
	var sessionSockets = new SessionSockets(io, sessionStore, cookieParser);
	sessionSockets.on('connection', function (err, socket, session) {
		function die(err){
			console.log('ERR', err);
			socket.emit('error', err.toString());
			socket.disconnect();
		}
		if (! (session && session.passport && session.passport.user && session.room)) return die ('invalid session');
		var userId = session.passport.user;
		if (!userId) return die('no authenticated user in session');
		db.on(userId)
		.then(db.getUserById)
		.then(function(completeUser){
			handleUserInRoom(socket, completeUser, db);
		}).catch(function(err){ die(err) })
		.finally(db.off);
	});
}
