"use strict";

var config = require('./config.json'),
	server = require('./libs/server.js');

server.start(config);

process.on('SIGINT', function() {
	console.log("Received SIGINT" );
	server.stop(function(){
		process.exit( );
	});
})
