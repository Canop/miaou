var auths = require('./auths.js'),
	server = require('./server.js'),
	memobjects = {},
	langs;
	
exports.configure = function(miaou){
	langs = require('./langs.js').configure(miaou);
	return this;
}

// returns a shared unpersisted object relative to the room
exports.mem = function(roomId){
	var mo = memobjects[roomId];
	if (!mo) mo = memobjects[roomId] = {};
	return mo;
}

// room admin page GET
exports.appGetRoom = function(req, res, db){
	db.on([+req.param('id'), +req.user.id])
	.spread(db.fetchRoomAndUserAuth)
	.then(function(room){
		if (!auths.checkAtLeast(room.auth, 'admin')) {
			return server.renderErr(res, "Admin level is required to manage the room");
		}
		res.render('room.jade', { room:JSON.stringify(room), error:"null", langs:JSON.stringify(langs.legal) });
	}).catch(db.NoRowError, function(){
		res.render('room.jade', { room:"null", error:"null", langs:JSON.stringify(langs.legal) });
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
		res.render('room.jade', { room: JSON.stringify(room), error: JSON.stringify(err.toString()) });
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
		res.render(server.mobile(req) ? 'rooms.mob.jade' : 'rooms.jade', { rooms:rooms, pings:pings, user:req.user, langs:langs.legal });
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
