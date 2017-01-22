"use strict";
const	Promise = require("bluebird"),
	auths = require('./auths.js'),
	server = require('./server.js'),
	prefs = require('./prefs.js'),
	maxAgeForNotableMessages = 10*24*60*60, // in seconds
	memobjects = new Map,
	clean = require('./ws.js').clean;

var	langs,
	db,
	welcomeRoomIds;

exports.configure = function(miaou){
	langs = require('./langs.js').configure(miaou);
	db = miaou.db;
	welcomeRoomIds = miaou.config.welcomeRooms || [];
	return this;
}

class MemRoom{
	constructor(roomId){
		this.id = roomId;
		this.resolvers = []; // set to null when loaded
	}
	load(con){
		let	memroom = this,
			roomId = this.id,
			now = Date.now()/1000|0;
		return con
		.getNotableMessages(roomId, now-maxAgeForNotableMessages)
		.then(function(notables){
			for (var i=0; i<notables.lenght; i++) clean(notables[i]);
			memroom.notables = notables;
			return con.getLastMessageId(roomId);
		}).then(function(m){
			if (m) memroom.lastMessageId = m.id;
			memobjects.set(roomId, memroom);
			for (var i=0; i<memroom.resolvers.length; i++) {
				memroom.resolvers[i].resolve(this);
			}
			memroom.resolvers = null;
			return memroom;
		});
	}
	updateNotables(con){
		let memroom = this;
		return con
		.getNotableMessages(memroom.id, Date.now()/1000-maxAgeForNotableMessages|0)
		.then(function(notables){
			for (var i=0; i<notables.lenght; i++) clean(notables[i]);
			memroom.notables = notables;
			return notables;
		});
	}
}

// returns a promise for a shared unpersisted object relative to the room
// the context of the call must be a db con
//  memroom : {
//   id, //  id of the room
//   lastMessageId,
//   notables, // notable messages
//   accessRequests, // unanswered access requests
//  }
exports.mem = function(roomId){
	var memroom = memobjects.get(roomId);
	if (memroom) {
		if (memroom.resolvers) {
			console.log("memroom", roomId, "-> WAIT load");
			var resolver = Promise.defer();
			memroom.resolvers.push(resolver);
			return resolver.promise;
		}
		return memroom;
	}
	memroom = new MemRoom(roomId);
	return memroom.load(this);
}

// called in case of a possibly cached message being changed
exports.updateMessage = function(message){
	if (!message.id || !message.room) return;
	var mo = memobjects.get(message.room);
	if (!mo) return;
	for (var i=0; i<mo.notables.length; i++) {
		if (mo.notables[i].id===message.id) {
			mo.notables[i] = message;
			return;
		}
	}
}

// room admin page GET
exports.appGetRoom = function(req, res){
	var theme;
	db.on()
	.then(function(){
		return prefs.get.call(this, req.user.id);
	})
	.then(function(userPrefs){
		theme = prefs.theme(userPrefs, req.query.theme);
		return this.fetchRoomAndUserAuth(+req.query.id, +req.user.id);
	})
	.then(function(room){
		if (!auths.checkAtLeast(room.auth, 'admin')) {
			return server.renderErr(res, "Admin level is required to manage the room");
		}
		res.render('room.jade', {
			vars:{ room, error:null, langs:langs.legal }, theme
		});
	})
	.catch(db.NoRowError, function(){
		// that's where we go in case of room creation
		res.render('room.jade', { // TODO ???
			vars:{ error:null, langs:langs.legal }, theme
		});
	})
	.catch(function(err){
		server.renderErr(res, err);
	})
	.finally(db.off);
}

// room admin page POST
exports.appPostRoom = function(req, res){
	var roomId = +req.query.id;
	if (req.body.name && !/^[^\[\]]{2,50}$/.test(req.body.name)) {
		return server.renderErr(res, "invalid room name");
	}
	var room = {
		name: req.body.name,
		private: req.body.private==="on",
		listed: req.body.listed==="on",
		dialog: false,
		description: req.body.description.replace(/\r\n?/g, '\n'),
		tags: (req.body.tags||"").split(/\s+/).filter(Boolean),
		lang: req.body.lang
	};
	db.on().then(function(){
		if (!roomId) {
			// room creation
			return this.createRoom(room, [req.user])
			.then(function(){
				return this.setRoomTags(room.id, room.tags);
			});
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
				return	this.updateRoom(room, req.user, oldroom.auth)
				.then(function(){
					return this.setRoomTags(room.id, room.tags);
				});
			})
		}
	}).then(function(){
		res.redirect(server.roomUrl(room));	// executes the room get
	}).catch(function(err){
		res.render('room.jade', {vars:{ room, error:err.toString() }});
	}).finally(db.off);
}

// rooms list GET (home page)
exports.appGetRooms = function(req, res){
	var userId = req.user.id;
	db.on(welcomeRoomIds)
	.map(function(roomId){
		return this.fetchRoomAndUserAuth(roomId, userId, true)
	})
	.filter(function(welcomeRoom, i){
		if (welcomeRoom) return true;
		console.log("WARNING: missing welcome room (id is "+welcomeRoomIds[i]+")");
	})
	.then(function(welcomeRooms){
		return [
			this.fetchUserPingRooms(userId),
			welcomeRooms,
			prefs.get.call(this, userId),
			this.listUserWatches(userId)
		]
	})
	.spread(function(pings, welcomeRooms, userPrefs, watches){
		welcomeRooms.forEach(function(r){
			r.path = server.roomPath(r)
		});
		var mobile = server.mobile(req);
		let data = {
			vars:{
				langs: langs.legal, mobile, me: req.user,
				welcomeRooms, watches, pings
			},
			user: req.user, pings
		};
		if (mobile) {
			res.render('rooms.mob.jade', data);
		} else {
			data.theme = prefs.theme(userPrefs, req.query.theme);
			res.render('rooms.jade', data);
		}
	})
	.catch(function(err){
		server.renderErr(res, err);
	})
	.finally(db.off);
}

exports.appGetJsonRoom = function(req, res){
	res.setHeader("Cache-Control", "public, max-age=120"); // 2 minutes
	db.on([req.query.id, req.user.id])
	.spread(db.fetchRoomAndUserAuth)
	.then(function(room){
		room.path = server.roomPath(room)
		res.json({ room });
	})
	.catch(function(err){
		res.json({error: err.toString()});
	})
	.finally(db.off);
}

exports.appGetJsonRooms = function(req, res){
	res.setHeader("Cache-Control", "public, max-age=120"); // 2 minutes
	db.on([req.user.id, req.query.pattern])
	.spread(db.listFrontPageRooms)
	.then(function(rooms){
		rooms.forEach(function(r){
			r.path = server.roomPath(r)
		});
		res.json(
			{ rooms, langs:langs.legal }
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

