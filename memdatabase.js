// Temporary non persistent implementation of a database for Miaou.

var
	NB_MESSAGES_PER_ROOM = 10000,
	rooms = {},
	nextId = Date.now();

function getRoom(roomId){
	var room = rooms[roomId];
	if (!room) rooms[roomId] = room = { messages:[]};
	return room
}

// stores the message, sets and returns its unique id (a number)
exports.storeMessage = function(roomId, m){
	var room = getRoom(roomId);
	if (room.messages.length>=NB_MESSAGES_PER_ROOM) rooms.messages.shift();
	m.id = nextId++;
	room.messages.push(m);
	return m;
}

exports.recentMessages = function(roomId, nb) {
	var room = getRoom(roomId);
	return room.messages.slice(-nb);
}


