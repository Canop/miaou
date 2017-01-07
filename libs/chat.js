const	Promise = require("bluebird"),
	fs = require('fs'),
	path = require('path'),
	auths = require('./auths.js'),
	prefs = require('./prefs.js'),
	server = require('./server.js');

var	clientSidePluginNames,
	accessRequestPlugins,
	db;

exports.configure = function(miaou){
	clientSidePluginNames = (miaou.config.plugins||[]).filter(function(n){
		return fs.existsSync(path.resolve(__dirname, '..', n, '..', 'client-scripts'))
	}).map(p=>p.split('/').slice(-2, -1)[0]);
	accessRequestPlugins = miaou.plugins.filter(p => p.beforeAccessRequest);
	db = miaou.db;
	return this;
}

exports.appGet = function(req, res){
	var	roomId = +req.params[0],
		userId = req.user.id;
	if (!roomId) {
		// not an error as it happens when there's no room id in url
		res.redirect(server.url('/rooms'));
		return;
	}
	db.on()
	.then(function(){
		return [
			this.fetchRoomAndUserAuth(roomId, userId),
			this.getRoomUserActiveBan(roomId, userId),
			prefs.get.call(this, userId)
		]
	})
	.spread(function(room, ban, userPrefs){
		console.log('room:', room);
		room.path = server.roomPath(room);
		req.session.room = room;
		var	isMobile = server.mobile(req),
			theme = prefs.theme(userPrefs, req.query.theme, isMobile);
		if (ban || (room.private && !auths.checkAtLeast(room.auth, 'write'))) {
			if (room.dialog) {
				return server.renderErr(res, "You can't enter this room");
			}
			console.log("USER:", req.user);
			return this.getLastAccessRequest(room.id, req.user.id)
			.then(function(ar){
				var args = {
					vars: { room },
					room,
					lastAccessRequest:ar,
					theme,
					canQueryAccess: true,
					specificMessage: null
				};
				return Promise.reduce(accessRequestPlugins, function(args, p){
					return p.beforeAccessRequest(args, req.user);
				}, args);
			})
			.then(function(args){
				res.render('request.jade', args);
			});
		}
		var locals = {
			me: req.user,
			room,
			userPrefs,
			pluginsToStart: clientSidePluginNames
		};
		res.render(isMobile ? 'pad.mob.jade' : 'pad.jade', {vars:locals, theme});
	})
	.catch(db.NoRowError, function(){
		console.log("no room found for id", roomId);
		res.redirect(server.url('/rooms'));
	})
	.catch(function(err){
		server.renderErr(res, err);
	})
	.finally(db.off);
}
