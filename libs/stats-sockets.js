"use strict";

// !!stats sockets command

exports.doStats = function(ct, io) {
	var	transports = new Map(), // map transportName -> number
		nbSockets = 0,
		nbInvalidSockets = 0,
		users = new Map(); // map userId -> number
	for (var clientId in io.sockets.connected) {
		var socket = io.sockets.connected[clientId];
		nbSockets++;
		try {
			var transportName = socket.conn.transport.name;
			transports.set(transportName, (transports.get(transportName)||0) + 1);	
			var userId = socket.publicUser.id;
			users.set(userId, (users.get(userId)||0) + 1);	
		} catch (e) {
			console.log('error in stats sockets', e);
			nbInvalidSockets++;
		}
		var c = 'Sockets Statistics\n';
		c += nbSockets + ' sockets for ' + users.size + ' different users\n';
		if (nbInvalidSockets) c += nbInvalidSockets + ' invalid sockets\n';
		c += 'Transport|Connections\n-|:-:\n';
		transports.forEach(function(nb, name){
			c += name + '|' + nb + '\n';
		});
		ct.reply(c, ct.nostore = c.length>800);
	}
}
