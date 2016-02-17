var	config,
	server = require('./libs/server.js');

console.log("Miaou running on "+process.title+" "+process.version);

// config may be in a js or json file
try {
	config = require('./config.js');
} catch(err) {
	if (err.code==='MODULE_NOT_FOUND') {
		config = require('./config.json');
	} else {
		console.error('config.js loading failed');
		throw err;
	}
}

server.start(config);

process.on('SIGINT', function() {
	console.log("Received SIGINT" );
	server.stop(function(){
		process.exit( );
	});
})
