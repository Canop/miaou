"use strict";

const server = require('./server.js');
	
exports.configure = function(miaou){
	return this;
}

exports.appPostError = function(req, res){
	console.log("================================\nERROR IN BROWSER");
	['user','page','message','url','line','col','err'].forEach(function(n){
		console.log(n+":", req.query[n]);
	});
	console.log("================================\n");
	res.send("OK");
}
