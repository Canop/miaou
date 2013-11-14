var
	fs = require("fs"),
	express = require('express'),
	jade = require('jade'),
	app = express(),
	http = require('http'),
	server = http.createServer(app),
	config = eval('('+fs.readFileSync('config.json')+')'),
	db = require('./memdatabase.js');

function startServer(){
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.set("view options", { layout: false });
	app.use('/static', express.static(__dirname + '/static'));
	app.get('/', function(req, res){
		res.render('index.jade');
	});
	console.log('Miaou server starting on port', config.port);
	server.listen(config.port);

	io = require('socket.io').listen(server);
	io.set('log level', 1);
	io.sockets.on('connection', function (socket) {
		var user, room;
		socket.on('enter', function (data) {
			// FIXME Obviously there should be a lot of sanitization here
			user = data.user;
			if (room) socket.leave(room);
			room = data.room;
			socket.join(room);
			db.recentMessages(room, 300).forEach(function(m){
				socket.emit('message', m);
			});
			socket.broadcast.to(room).emit('enter', user);
		});
		socket.on('message', function (content) {
			// FIXME error if user or room not set
			console.log("user " + user.name + " send this : " + content, 'to', room);
			var m = { content: content, user: user };
			db.storeMessage(room, m);
			io.sockets.in(room).emit('message', m);
		});
	});
}

(function main() { // main
	startServer();
})();
