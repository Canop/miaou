"use strict";

const server = require('./server.js');
	
exports.configure = function(miaou){
	return this;
}

exports.appPostError = function(req, res, db){
	console.log("================================\nERROR IN BROWSER");
	['user','page','message','url','line','col','err'].forEach(function(n){
		console.log(n+":", req.param(n));
	});
	console.log("================================\n");
	res.send("OK");
}
