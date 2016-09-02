const	fs = require('fs'),
	path = require('path'),
	auths = require('./auths.js'),
	prefs = require('./prefs.js'),
	server = require('./server.js');

var	clientSidePluginNames,
	db;

exports.configure = function(miaou){
	clientSidePluginNames = (miaou.config.plugins||[]).filter(function(n){
		return fs.existsSync(path.resolve(__dirname, '..', n, '..', 'client-scripts'))
	}).map(p=>p.split('/').slice(-2, -1)[0]);
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
		room.path = server.roomPath(room);
		req.session.room = room;
		var theme = prefs.theme(userPrefs, req.query.theme);
		if (ban || (room.private && !auths.checkAtLeast(room.auth, 'write'))) {
			if (room.dialog) {
				return server.renderErr(res, "You can't enter this room");
			}
			return this.getLastAccessRequest(room.id, req.user.id).then(function(ar){
				res.render('request.jade', {
					vars:{ room },
					lastAccessRequest:ar, theme:theme
				});
			});
		}
		var locals = {
			me: req.user,
			room,
			userPrefs,
			pluginsToStart: clientSidePluginNames
		};
		if (server.mobile(req)) {
			res.render('pad.mob.jade', {vars:locals});
		} else {
			res.render('pad.jade', {vars:locals, theme:theme});
		}
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
