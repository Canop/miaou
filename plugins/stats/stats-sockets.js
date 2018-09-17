// !!stats sockets command

function incr(map, key){
	if (!key) return;
	map.set(key, (map.get(key)||0)+1);
}

exports.doStats = function(ct, miaou){
	let	io = miaou.io,
		transports = new Map, // map transportName -> number
		nbSockets = 0,
		nbInvalidSockets = 0,
		users = new Map, // map userId -> number
		userAgents = new Map; // map userAgent -> number
	for (let clientId in io.sockets.connected) {
		let socket = io.sockets.connected[clientId];
		nbSockets++;
		try {
			incr(transports, socket.conn.transport.name);
			incr(users, socket.publicUser.id);
			if (socket.request && socket.request.headers) {
				incr(userAgents, socket.request.headers["user-agent"]);
			}
		} catch (e) {
			console.log('error in stats sockets', e);
			nbInvalidSockets++;
		}
	}
	let c = 'Sockets Statistics\n';
	if (nbInvalidSockets) c += nbInvalidSockets + ' invalid sockets\n';
	c += 'Transport|Connections\n-|:-:\n';
	transports.forEach(function(nb, name){
		c += name + '|' + nb + '\n';
	});
	c += nbSockets + ' sockets for ' + users.size + ' different users\n';
	c += 'User Agent|Connections\n-|:-:\n';
	userAgents.forEach(function(nb, name){
		c += name + '|' + nb + '\n';
	});
	ct.reply(c, ct.nostore = c.length>800);
}
