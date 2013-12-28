var config = require('./config.json'),
	maxContentLength = config.maxMessageContentSize || 500,
	minDelayBetweenMessages = config.minDelayBetweenMessages || 5000,
	socketio = require('socket.io'),
	SessionSockets = require('session.socket.io'),
	io,
	maxAgeForNotableMessages = 14*24*60*60, // in seconds
	nbMessagesPerPage = 100,
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

function emitLastMessages(con, socket, roomId, userId, before, cb){
	var nbSent = 0, oldestSent;
	con.queryLastMessages(roomId, userId, nbMessagesPerPage, before).on('row', function(message){
		socket.emit('message', message);
		nbSent++;
		if (!(message.id>oldestSent)) oldestSent = message.id;
	}).on('end', function(){
		if (nbSent===nbMessagesPerPage) socket.emit('has_older', oldestSent); // well... probably more
		cb();
	});
}

// handles the socket, whose life should be the same as the presence of the user in a room without reload
// Implementation details :
//  - we don't pick the room in the session because it may be incorrect when the user has opened tabs in
//     different rooms and there's a reconnect
function handleUserInRoom(socket, completeUser, mdb){
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
		mdb.con(function(err, con){
			if (err) return error('no connection'); // todo kill everything
			con.insertAccessRequest(roomId, publicUser.id, function(err, ar){
				con.ok();
				ar.user = publicUser;
				socket.broadcast.to(roomId).emit('request', ar);
				socketWaitingApproval.push({
					socket:socket, userId:publicUser.id, roomId:roomId, ar:ar
				});
			});
		});
	}).on('clear_pings', function(lastPingTime, ack){ // tells that pings in the room have been seen, and ask if there are pings in other rooms
		if (!room) {
			console.log('No room in clear_pings');
			return;
		}
		mdb.con(function(err, con){
			if (err) return error('no connection'); // todo kill everything
			con.deletePings(room.id, publicUser.id, function(err){
				con.fetchUserPingRooms(publicUser.id, lastPingTime, function(err, pings){
					con.ok();
					if (ack) ack(pings);
				});
			});
		});
	}).on('enter', function(roomId, ack){
		console.log(publicUser.name, 'enters', roomId);
		var now = ~~(Date.now()/1000);
		if (ack) ack(now);
		mdb.con(function(err, con){
			if (err) return error('no connection'); // todo kill everything
			con.fetchRoomAndUserAuth(roomId, publicUser.id, function(err, r){
				if (err) return error(err);
				if (r==null) return error('Room not found');
				if (r.private && !r.auth) return error('Unauthorized user');
				room = r;
				socket.emit('room', room);
				socket.join(room.id);
				emitLastMessages(con, socket, room.id, publicUser.id, null, function(){
					socket.broadcast.to(room.id).emit('enter', publicUser);
					socketWaitingApproval.forEach(function(o){
						if (o.roomId===room.id) {
							socket.emit('request', o.ar);
						}
					});
					con.getNotableMessages(room.id, now-maxAgeForNotableMessages, function(err, messages){
						messages.forEach(function(m){ socket.emit('notable_message', m) });
						con.deletePings(room.id, publicUser.id, con.ok);
						socket.emit('welcome');
					});
				});
				io.sockets.clients(room.id).forEach(function(s){
					s.get('publicUser', function(err, u){
						if (err) console.log('missing user on socket', err);
						else socket.emit('enter', u);
					});
				});
			});
		});
	}).on('get_older', function(mid){
		mdb.con(function(err, con){
			if (err) return error('no connection'); // todo kill everything
			emitLastMessages(con, socket, room.id, publicUser.id, mid, con.ok);
		});
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
			mdb.con(function(err, con){
				if (err) return error('no connection');
				con.storeMessage(m, function(err, m){
					if (err) return error(err);
					var pings = m.content.match(/@\w[\w_\-\d]{2,}(\b|$)/g);
					if (pings) {
						con.storePings(room.id, pings.map(function(s){ return s.slice(1) }), m.id, function(){
							con.ok();						
						})
					} else {
						con.ok();
					}
					io.sockets.in(room.id).emit('message', m);
				});
			});
		}
	}).on('vote', function(vote){
		if (vote.level=='pin' && !(room.auth==='admin'||room.auth==='own')) return;
		mdb.con(function(err, con){
			if (err) return error('no connection');
			con[vote.action==='add'?'addVote':'removeVote'](room.id, publicUser.id, vote.message, vote.level, function(err, updatedMessage){
				if (err) return error(err);
				con.ok();
				socket.emit('message', updatedMessage);
				var clone = {};
				for (var key in updatedMessage) clone[key]= key==='vote' ? '?' : updatedMessage[key]; // a value '?' means for browser "keep the existing value"
				socket.broadcast.to(room.id).emit('message', clone);
			});
		});		
	}).on('disconnect', function(){ // todo : are we really assured to get this event which is used to clear things ?
		console.log(completeUser.name, "disconnected");
		if (room) socket.broadcast.to(room.id).emit('leave', publicUser);
		popon(socketWaitingApproval, function(o){ return o.socket===socket });
	});
}

exports.listen = function(server, sessionStore, cookieParser, mdb){
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
		mdb.con(function(err, con){
			if (err) return die(err);
			con.fetchUserById(userId, function(err, completeUser){
				if (err) return die(err);
				con.ok();
				handleUserInRoom(socket, completeUser, mdb);
			});
		});
	});
}
