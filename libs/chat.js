const	fs = require('fs'),
	nbMessagesAtLoad = 30,
	path = require('path'),
	auths = require('./auths.js'),
	ws = require('./ws.js'),
	prefs = require('./prefs.js'),
	server = require('./server.js');

var	clientSidePluginNames,
	accessRequestPlugins,
	features,
	db;

exports.configure = function(miaou){
	clientSidePluginNames = (miaou.config.plugins||[]).filter(function(n){
		return fs.existsSync(path.resolve(__dirname, '..', n, '..', 'client-scripts'))
	}).map(p=>p.split('/').slice(-2, -1)[0]);
	accessRequestPlugins = miaou.plugins.filter(p => p.beforeAccessRequest);
	features = {
		search: {
			regularExpressions: miaou.conf("search", "regularExpressions"),
			exactExpressions: miaou.conf("search", "exactExpressions")
		}
	};
	db = miaou.db;
	return this;
}

exports.appGet = function(req, res){
	let	roomId = +req.params[0],
		userId = req.user.id;
	if (!roomId) {
		// not an error as it happens when there's no room id in url
		res.redirect(server.url('/rooms'));
		return;
	}
	db.do(async function(con){
		let room = await con.fetchRoomAndUserAuth(roomId, userId);
		if (!room) throw new Error("No room with id " + roomId);
		room.path = server.roomPath(room);
		req.session.room = room;
		let	isMobile = server.mobile(req),
			userGlobalPrefs = await prefs.getUserGlobalPrefs(con, userId),
			theme = await prefs.theme(con, userId, req.query.theme, isMobile);
		let ban = await con.getRoomUserActiveBan(roomId, userId);
		if (ban || (room.private && !auths.checkAtLeast(room.auth, 'write'))) {
			let lastAccessRequest = await con.getLastAccessRequest(roomId, userId);
			let args = {
				vars: {
					met: req.user,
					room,
					prefDefinitions: prefs.getDefinitions(),
					theme
				},
				room,
				lastAccessRequest,
				canQueryAccess: true,
				specificMessage: null
			};
			for (let i=0; i<accessRequestPlugins.length; i++) {
				args = await accessRequestPlugins[i].beforeAccessRequest(args, req.user);
			}
			res.render("request.pug", args);
			return;
		}
		let messages = await con.getMessages(roomId, userId, nbMessagesAtLoad, false);
		messages = messages.map(m => ws.clean(m));
		// messages don't go through onSendMessages plugins. This isn't important
		// Boxing will be done by a message resending after socket connection
		let locals = {
			me: req.user,
			room,
			features,
			messages,
			prefDefinitions: prefs.getDefinitions(),
			userGlobalPrefs,
			pluginsToStart: clientSidePluginNames,
			theme
		};
		res.render(isMobile ? 'pad.mob.pug' : 'pad.pug', {vars:locals});
	}, function(err){
		server.renderErr(req, res, err);
	});
}
