var fs = require("fs"),
	express = require('express'),
	jade = require('jade'),
	app = express(),
	http = require('http'),
	server = http.createServer(app),
	config = eval('('+fs.readFileSync('config.json')+')'),
	mdb = require('./pgdb.js').init(config.database),
	maxContentLength = config.maxMessageContentSize || 500,
	minDelayBetweenMessages = config.minDelayBetweenMessages || 5000;

function startServer(){
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.set("view options", { layout: false });
	app.use('/static', express.static(__dirname + '/static'));
	app.get('/', function(req, res){
		res.render('index.jade');
	});
	app.get('/help', function(req, res){
		res.render('help.jade');
	});
	console.log('Miaou server starting on port', config.port);
	server.listen(config.port);

	io = require('socket.io').listen(server);
	io.set('log level', 1);
	io.sockets.on('connection', function (socket) {
		var user, room, lastMessageTime;
		function error(err){
			console.log('ERR', err, 'for user', user, 'in room', room);
			socket.emit('error', err.toString());
		}
		socket.on('enter', function (data) {
			if (data.user && data.user.name && /^\w[\w_\-\d]{2,19}$/.test(data.user.name) && data.room) {
				mdb.con(function(err, con){
					if (err) return error('no connection');
					con.fetchUser(data.user.name, function(err, u){
						if (err) return error(err);						
						user = u;
						socket.set('user', user);
						if (room) socket.leave(room.name);
						con.fetchRoom(data.room, function(err, r){
							if (err) return error(err);
							room = r;
							socket.emit('room', room) 
							socket.join(room.id);
							con.queryLastMessages(room.id, 300).on('row', function(message){
								socket.emit('message', message);
							}).on('end', function(){
								con.ok();
								socket.broadcast.to(room.id).emit('enter', user);
							});
							io.sockets.clients(room.id).forEach(function(s){
								s.get('user', function(err, u){
									if (err) console.log('missing user on socket', err);
									else socket.emit('enter', u);
								});
							});
						});
					});
				});
			} else {
				error('bad login');
			}
		}).on('message', function (content) {
			var now = Date.now();
			if (!(user && room)) {
				error('User or room not defined');
			} else if (content.length>maxContentLength) {
				error('Message too big, consider posting a link instead');
				console.log(content.length, maxContentLength);
			} else if (now-lastMessageTime<minDelayBetweenMessages) {
				error("You're too fast (minimum delay between messages : "+minDelayBetweenMessages+" ms)");
			} else {
				lastMessageTime = now;
				var m = { content: content, author: user.id, authorname: user.name, room: room.id, created: now};
				//~ console.log(m);
				mdb.con(function(err, con){
					if (err) return error('no connection');
					con.storeMessage(m, function(err, m){
						if (err) return error(err);						
						con.ok();
						console.log("user ", user.name, 'send a message to', room);
						io.sockets.in(room.id).emit('message', m);
					});
				});
			}
		}).on('disconnect', function(){
			if (room) socket.broadcast.to(room.id).emit('leave', user);
		});
	});
}

(function main() { // main
	startServer();
})();
