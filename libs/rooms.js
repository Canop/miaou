"use strict";

const auths = require('./auths.js'),
	server = require('./server.js'),
	prefs = require('./prefs.js'),
	maxAgeForNotableMessages = 50*24*60*60, // in seconds
	memobjects = new Map,
	clean = require('./ws.js').clean;

var langs,
	db,
	welcomeRoomIds;
	
exports.configure = function(miaou){
	langs = require('./langs.js').configure(miaou);
	db = miaou.db;
	welcomeRoomIds = miaou.config.welcomeRooms || [];
	return this;
}

// returns a shared unpersisted object relative to the room
// the context of the call must be a db con
exports.mem = function(roomId){
	var mo = memobjects.get(roomId);
	if (!mo) {
		mo = { id:roomId };
		memobjects.set(roomId, mo);
		var now = Date.now()/1000|0;
		return this
		.getNotableMessages(roomId, now-maxAgeForNotableMessages)
		.then(function(notables){
			for (var i=0; i<notables.lenght; i++) clean(notables[i]);
			mo.notables = notables;
			return mo;
		});
	}
	return mo;
}

// updates the list and resolves the closure with it
// context of the call must be a db con
exports.updateNotables = function(memroom){
	return this
	.getNotableMessages(memroom.id, Date.now()/1000-maxAgeForNotableMessages|0)
	.then(function(notables){
		for (var i=0; i<notables.lenght; i++) clean(notables[i]);
		memroom.notables = notables;
		return notables;
	});
}

// room admin page GET
exports.appGetRoom = function(req, res){
	var theme;
	db.on().then(function(){
		return prefs.get.call(this, req.user.id);
	}).then(function(userPrefs){
		theme = prefs.theme(userPrefs, req.query.theme);
		return this.fetchRoomAndUserAuth(+req.query.id, +req.user.id);
	})
	.then(function(room){
		if (!auths.checkAtLeast(room.auth, 'admin')) {
			return server.renderErr(res, "Admin level is required to manage the room");
		}
		res.render('room.jade', {
			vars:{ room:room, error:null, langs:langs.legal }, theme:theme
		});
	}).catch(db.NoRowError, function(){
		res.render('room.jade', { // TODO ???
			vars:{ error:null, langs:langs.legal }, theme:theme
		});
	}).catch(function(err){
		server.renderErr(res, err);
	}).finally(db.off);
}

// room admin page POST
exports.appPostRoom = function(req, res){
	var roomId = +req.query.id;
	if (req.body.name && !/^.{2,50}$/.test(req.body.name)) {
		return server.renderErr(res, "invalid room name");
	}
	var room = {
		name: req.body.name,
		private: req.body.private==="on",
		listed: req.body.listed==="on",
		dialog: false,
		description: req.body.description.replace(/\r\n?/g, '\n'),
		lang: req.body.lang
	};
	db.on().then(function(){		
		if (!roomId) {
			// room creation
			return this.createRoom(room, [req.user]);
		} else {
			// room edition
			return this.fetchRoomAndUserAuth(roomId, req.user.id)
			.then(function(oldroom){
				if (oldroom.auth!=='admin' && oldroom.auth!=='own') {
					throw "Unauthorized user";
				}
				room.id = roomId;
				if (oldroom.dialog) {
					room.name = oldroom.name;
					room.dialog = true;
					room.private = true;
					room.listed = false;
				}
				return this.updateRoom(room, req.user, oldroom.auth);
			})
		}
	}).then(function(){
		res.redirect(server.roomUrl(room));	// executes the room get
	}).catch(function(err){
		res.render('room.jade', {vars:{ room:room, error:err.toString() }});
	}).finally(db.off);
}

// rooms list GET
exports.appGetRooms = function(req, res){
	db.on(welcomeRoomIds)
	.map(function(roomId){
		return this.fetchRoomAndUserAuth(roomId, req.user.id)
	})
	.then(function(welcomeRooms){
		return [
			this.listFrontPageRooms(req.user.id),
			this.fetchUserPingRooms(req.user.id, 0),
			welcomeRooms,
			prefs.get.call(this, req.user.id)
		]
	})
	.spread(function(rooms, pings, welcomeRooms, userPrefs){
		rooms.forEach(function(r){ r.path = server.roomPath(r) });
		welcomeRooms.forEach(function(r){ r.path = server.roomPath(r) });
		var mobile = server.mobile(req);
		res.render(mobile ? 'rooms.mob.jade' : 'rooms.jade', {
			vars:{rooms:rooms, langs:langs.legal, mobile:mobile, welcomeRooms:welcomeRooms},
			user:req.user, pings:pings, theme:prefs.theme(userPrefs, req.query.theme)
		});
	})
	.catch(function(err){
		server.renderErr(res, err);
	})
	.finally(db.off);
}

exports.appGetJsonRooms = function(req, res){
	db.on(req.user.id)
	.then(db.listFrontPageRooms)
	.then(function(rooms){
		rooms.forEach(function(r){ r.path = server.roomPath(r) });
		res.json(
			{ rooms:rooms, langs:langs.legal }
		);
	})
	.catch(function(err){
		res.json({error: err.toString()});
	})
	.finally(db.off);
}

// rooms list POST
exports.appPostRooms = function(req, res){
	db.on()
	.then(function(){
		if (req.body.clear_pings) return this.deleteAllUserPings(req.user.id)
	})
	.then(function(){
		res.redirect("rooms");	// executes the rooms list get
	})
	.catch(function(err){
		server.renderErr(res, err);
	})
	.finally(db.off);
}
