"use strict";
const	Promise = require("bluebird"),
	auths = require('./auths.js'),
	server = require('./server.js'),
	BoundedCache = require('bounded-cache'),
	prefs = require('./prefs.js'),
	maxAgeForNotableMessages = 1*24*60*60, // in seconds
	NB_RECENT_AUTHORS = 50,
	memobjects = new Map,
	ws = require('./ws.js'),
	clean = require('./ws.js').clean;

var	langs,
	db,
	welcomeRoomIds;

exports.configure = function(miaou){
	langs = miaou.lib("langs");
	db = miaou.db;
	welcomeRoomIds = miaou.config.welcomeRooms || [];
	return this;
}

class MemRoom{
	constructor(roomId){
		this.id = roomId;
		this.resolvers = []; // set to null when loaded
		this.notables = []; // filled on load
		this.recentAuthorsCache = BoundedCache(NB_RECENT_AUTHORS); // filled on load
	}
	async load(con){
		await this.updateNotables(con);
		let m = await con.getLastMessageId(this.id);
		if (m) this.lastMessageId = m.id;
		await this.loadRecentAuthors(con);
		memobjects.set(this.id, this);
		for (var i=0; i<this.resolvers.length; i++) {
			this.resolvers[i].resolve(this);
		}
		this.resolvers = null;
		return this;
	}
	async updateNotables(con){
		let now = Date.now()/1000|0;
		let notables = await con.getNotableMessages(this.id, now-maxAgeForNotableMessages);
		for (var i=0; i<notables.lenght; i++) clean(notables[i]);
		this.notables = notables;
	}
	async loadRecentAuthors(con){
		let recentUsers = await con.listRecentUsers(this.id, NB_RECENT_AUTHORS);
		for (let i=recentUsers.length; i--;) {
			let p = recentUsers[i];
			this.recentAuthorsCache.set(p.id, p);
		}
	}
	addAuthor(p){
		this.recentAuthorsCache.set(p.id, p);
	}
	recentAuthors(){
		let entries = this.recentAuthorsCache.content();
		let authors = []; // cache this array?
		for (let i=entries.length; i--;) {
			authors.push(entries[i].value);
		}
		return authors;
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
	db.do(async function(con){
		let theme = await prefs.theme(con, req.user.id, req.query.theme);
		let vars = {
			me: req.user,
			prefDefinitions: prefs.getDefinitions(),
			error: null,
			langs: langs.legal,
			theme
		};
		let room;
		try {
			room = await con.fetchRoomAndUserAuth(+req.query.id, +req.user.id);
			if (!auths.checkAtLeast(room.auth, 'admin')) {
				return server.renderErr(req, res, "Admin level is required to manage the room");
			}
			vars.room = room;
		} catch (e) {
			if (!(e instanceof db.NoRowError)) throw e;
			// in case of room creation we just render room.pug without vars.room
		}
		res.render('room.pug', { vars });
	}, function(err){
		server.renderErr(req, res, err);
	});
}

// room admin page POST
exports.appPostRoom = function(req, res){
	var roomId = +req.query.id;
	if (!/^[^\[\]]{2,50}$/.test(req.body.name)) {
		return server.renderErr(req, res, "invalid room name");
	}
	if (req.body.img && !/^https:\/\/\S{4,220}$/.test(req.body.img)) {
		return server.renderErr(req, res, "invalid room illustration:" + req.body.img);
	}
	var room = {
		name: req.body.name,
		private: req.body.private==="on",
		listed: req.body.listed==="on",
		dialog: false,
		img: req.body.img,
		description: req.body.description.replace(/\r\n?/g, '\n'),
		tags: (req.body.tags||"").split(/\s+/).filter(Boolean),
		lang: req.body.lang
	};
	db.do(async function(con){
		if (!roomId) {
			// room creation
			await con.createRoom(room, [req.user]);
		} else {
			// room edition
			let oldroom = await con.fetchRoomAndUserAuth(roomId, req.user.id);
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
			await ws.botMessage(null, roomId, `@${req.user.name} edited the room`);
			await con.updateRoom(room, req.user, oldroom.auth);
		}
		await con.setRoomTags(room.id, room.tags);
		res.redirect(server.roomUrl(room));	// executes the room get
	}, async function(err){
		return server.renderErr(req, res, err);
	});
}

// rooms list GET (home page)
exports.appGetRooms = function(req, res){
	let userId = req.user.id;
	db.do(async function(con){
		let welcomeRooms = [];
		for (let i=0; i<welcomeRoomIds.length; i++) {
			let roomId = welcomeRoomIds[i];
			try {
				let room = await con.fetchRoomAndUserAuth(roomId, userId, true);
				room.path = server.roomPath(room)
				welcomeRooms.push(room);
			} catch (e) {
				console.error(`Error while fetching welcome room ${roomId}. Please check configuration.`);
			}
		}
		let pings = await con.fetchUserPingRooms(userId);
		let watches = await con.listUserWatches(userId);
		var mobile = server.mobile(req);
		let userGlobalPrefs = await prefs.getUserGlobalPrefs(con, userId);
		let data = {
			vars: {
				me: req.user,
				langs: langs.legal,
				mobile,
				prefDefinitions: prefs.getDefinitions(),
				me: req.user,
				welcomeRooms,
				userGlobalPrefs,
				watches,
				pings
			},
			user: req.user,
			pings
		};
		data.vars.theme = await prefs.theme(con, userId, req.query.theme);
		res.render(mobile ? 'rooms.mob.pug' : 'rooms.pug', data);
	}, function(err){
		server.renderErr(req, res, err);
	});
}

exports.appGetJsonRoom = function(req, res){
	res.setHeader("Cache-Control", "public, max-age=120"); // 2 minutes
	db.do(async function(con){
		let room = await con.fetchRoomAndUserAuth(req.query.id, req.user.id);
		room.path = server.roomPath(room);
		res.json({ room });
	}, function(err){
		res.json({error: err.toString()});
	});
}

exports.appGetJsonRooms = function(req, res){
	res.setHeader("Cache-Control", "public, max-age=120"); // 2 minutes
	db.do(async function(con){
		let nonDialogRooms = await con.listFrontPageRooms(req.user.id, {
			pattern: req.query.pattern,
			dialog: false,
			limit: 100
		});
		let dialogRooms = await con.listFrontPageRooms(req.user.id, {
			pattern: req.query.pattern,
			dialog: true,
			limit: 500
		});
		let rooms = nonDialogRooms.concat(dialogRooms);
		rooms.forEach(r => {
			r.path = server.roomPath(r);
		});
		res.json({ rooms, langs:langs.legal });
	}, function(err){
		res.json({error: err.toString()});
	});
}

// rooms list POST
exports.appPostRooms = function(req, res){
	db.do(async function(con){
		if (req.body.clear_pings) await con.deleteAllUserPings(req.user.id)
		res.redirect("rooms"); // executes the rooms list get
	}, function(err){
		server.renderErr(req, res, err);
	});
}

