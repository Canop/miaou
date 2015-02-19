"use strict";

var config = require('./config.json'),
	server = require('./libs/server.js');

console.log("Running on "+process.title+" "+process.version);

server.start(config);

process.on('SIGINT', function() {
	console.log("Received SIGINT" );
	server.stop(function(){
		process.exit( );
	});
})
