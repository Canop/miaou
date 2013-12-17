var config = require('./config.json'),
	maxContentLength = config.maxMessageContentSize || 500,
	minDelayBetweenMessages = config.minDelayBetweenMessages || 5000,
	socketio = require('socket.io'),
	SessionSockets = require('session.socket.io'),
	io,
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
				console.log('insertion access request:', err, ar);
				socket.broadcast.to(roomId).emit('request', ar);
				socketWaitingApproval.push({
					socket:socket, userId:publicUser.id, roomId:roomId, ar:ar
				});
			});
		});
	}).on('enter', function(roomId){
		console.log(publicUser.name, 'enters', roomId);
		mdb.con(function(err, con){
			if (err) return error('no connection'); // todo kill everything
			con.fetchRoomAndUserAuth(roomId, publicUser.id, function(err, r){
				if (err) return error(err);
				if (r==null) return error('Room not found');
				if (r.private && !r.auth) return error('Unauthorized user');
				room = r;
				socket.emit('room', room);
				socket.join(room.id);
				con.queryLastMessages(room.id, 300).on('row', function(message){
					socket.emit('message', message);
				}).on('end', function(){
					con.ok();
					socket.broadcast.to(room.id).emit('enter', publicUser);
					socketWaitingApproval.forEach(function(o){
						if (o.roomId===room.id) {
							socket.emit('request', o.ar);
						}
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
	}).on('message', function (message) {
		if (!room) {
			socket.emit('get_room', message);
			return;
		}
		var now = Date.now(), seconds = ~~(now/1000), content = message.content;
		if (content.length>maxContentLength) {
			error('Message too big, consider posting a link instead');
			console.log(content.length, maxContentLength);
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
					con.ok();
					console.log("user ", publicUser.name, 'send a message to', room.name);
					io.sockets.in(room.id).emit('message', m);
				});
			});
		}
	}).on('disconnect', function(){ // todo : are we really assured to get this event ?
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
