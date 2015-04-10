"use strict";

const fs = require('fs'),
	path = require('path'),
	auths = require('./auths.js'),
	prefs = require('./prefs.js'),
	server = require('./server.js');

var	clientSidePluginNames,
	db;

exports.configure = function(miaou){
	clientSidePluginNames = (miaou.config.plugins||[]).filter(function(n){
		return fs.existsSync(path.resolve(__dirname, '..', n, '..', 'client-scripts'))
	}).map(function(p) {
		return p.split('/').slice(-2,-1)[0]
	});
	db = miaou.db;
	return this;
}

exports.appGet = function(req, res){
	db.on()
	.then(function(){
		var roomId = +req.params[0],
			userId = req.user.id;
		return [
			this.fetchRoomAndUserAuth(roomId, userId),
			this.getRoomUserActiveBan(roomId, userId),
			prefs.get.call(this, userId)
		]
	})
	.spread(function(room, ban, userPrefs){
		room.path = server.roomPath(room);
		req.session.room = room;
		var theme = prefs.theme(userPrefs, req.query.theme);
		if (ban || (room.private && !auths.checkAtLeast(room.auth, 'write'))) {
			return this.getLastAccessRequest(room.id, req.user.id).then(function(ar){
				res.render('request.jade', {
					vars:{ room:room },
					lastAccessRequest:ar, theme:theme
				});
			});
		}
		var locals = {
			me:req.user,
			room:room,
			userPrefs:userPrefs,
			pluginsToStart:clientSidePluginNames
		};
		if (server.mobile(req)) {
			res.render('chat.mob.jade', {vars:locals});
		} else {
			res.render('pad.jade', {vars:locals, theme:theme});
		}
	}).catch(db.NoRowError, function(){
		// not an error as it happens when there's no room id in url
		res.redirect(server.url('/rooms'));
	}).catch(function(err){
		server.renderErr(res, err);
	}).finally(db.off);
}
