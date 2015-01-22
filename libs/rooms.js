"use strict";

const auths = require('./auths.js'),
	server = require('./server.js'),
	maxAgeForNotableMessages = 50*24*60*60, // in seconds
	memobjects = new Map,
	clean = require('./ws.js').clean;

var langs;
	
exports.configure = function(miaou){
	langs = require('./langs.js').configure(miaou);
	return this;
}

// returns a shared unpersisted object relative to the room
// the context of the call must be a db con
exports.mem = function(roomId){
	var mo = memobjects.get(roomId);
	if (!mo) {
		mo = {id:roomId};
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
exports.appGetRoom = function(req, res, db){
	db.on([+req.param('id'), +req.user.id])
	.spread(db.fetchRoomAndUserAuth)
	.then(function(room){
		if (!auths.checkAtLeast(room.auth, 'admin')) {
			return server.renderErr(res, "Admin level is required to manage the room");
		}
		res.render('room.jade', {vars:{ room:room, error:null, langs:langs.legal }});
	}).catch(db.NoRowError, function(){
		res.render('room.jade', {vars:{ room:null, error:null, langs:langs.legal }});
	}).catch(function(err){
		server.renderErr(res, err);
	}).finally(db.off);
}

// room admin page POST
exports.appPostRoom = function(req, res, db){
	var roomId = +req.param('id'), name = req.param('name').trim(), room;
	if (!/^.{2,50}$/.test(name)) {
		return server.renderErr(res, "invalid room name");
	}
	db.on([roomId, req.user.id, 'admin'])
	.spread(db.checkAuthLevel)
	.then(function(auth){
		room = {
			id:roomId, name:name, dialog:false,
			private:req.param('private')==="on",
			listed:req.param('listed')==="on",
			description:req.param('description').replace(/\r\n?/g, '\n'),
			lang:req.param('lang')
		};
		return [room, req.user, auth];
	}).spread(db.storeRoom)
	.then(function(){
		res.redirect(server.roomUrl(room));	// executes the room get
	}).catch(function(err){
		res.render('room.jade', {vars:{ room:room, error:err.toString() }});
	}).finally(db.off);
}

// rooms list GET
exports.appGetRooms = function(req, res, db){
	db.on()
	.then(function(){
		return [
			this.listFrontPageRooms(req.user.id),
			this.fetchUserPingRooms(req.user.id, 0)
		]
	})
	.spread(function(rooms, pings){
		rooms.forEach(function(r){ r.path = server.roomPath(r) });
		var mobile = server.mobile(req);
		res.render(
			mobile ? 'rooms.mob.jade' : 'rooms.jade',
			{ vars:{rooms:rooms, langs:langs.legal, mobile:mobile}, user:req.user, pings:pings }
		);
	})
	.catch(function(err){
		server.renderErr(res, err);
	})
	.finally(db.off);
}

// rooms list POST
exports.appPostRooms = function(req, res, db){
	db.on()
	.then(function(){
		if (req.param('clear_pings')) return this.deleteAllUserPings(req.user.id)
	})
	.then(function(){
		res.redirect("rooms");	// executes the rooms list get
	})
	.catch(function(err){
		server.renderErr(res, err);
	})
	.finally(db.off);
}
