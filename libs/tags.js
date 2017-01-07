"use strict";

var	db;

exports.configure = function(miaou){
	db = miaou.db;
	return this;
}

exports.appGetJsonTag = function(req, res){
	res.setHeader("Cache-Control", "public, max-age=120"); // 2 minutes
	db.on(req.query.name)
	.then(db.getTag)
	.then(function(tag){
		res.json({tag});
	})
	.catch(function(err){
		res.json({error: err.toString()});
	})
	.finally(db.off);
}

exports.appGetJsonTags = function(req, res){
	db.on(req.query.pattern)
	.then(db.searchTags)
	.then(function(tags){
		res.json(tags);
	})
	.catch(function(err){
		res.json({error: err.toString()});
	})
	.finally(db.off);
}

