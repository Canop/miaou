var auths = require('./auths.js'),
	utils = require('./app-utils.js'),
	langs;
	
exports.configure = function(conf){
	langs = require('./langs.js').configure(conf);
	return this;
}

exports.appGetRoom = function(req, res, db){
	db.on([+req.param('id'), +req.user.id])
	.spread(db.fetchRoomAndUserAuth)
	.then(function(room){
		if (!auths.checkAtLeast(room.auth, 'admin')) {
			return utils.renderErr(res, "Admin level is required to manage the room");
		}
		res.render('room.jade', { room:JSON.stringify(room), error:"null", langs:JSON.stringify(langs.legal) });
	}).catch(db.NoRowError, function(){
		res.render('room.jade', { room:"null", error:"null", langs:JSON.stringify(langs.legal) });
	}).catch(function(err){
		utils.renderErr(res, err);
	}).finally(db.off);
}

exports.appPostRoom = function(req, res, db){
	var roomId = +req.param('id'), name = req.param('name').trim(), room;
	if (!/^.{2,50}$/.test(name)) {
		return utils.renderErr(res, "invalid room name");
	}
	db.on([roomId, req.user.id, 'admin'])
	.spread(db.checkAuthLevel)
	.then(function(auth){
		room = {
			id:roomId, name:name, dialog:false,
			private:req.param('private')==="on",
			listed:req.param('listed')==="on",
			description:req.param('description'),
			lang:req.param('lang')
		};
		return [room, req.user, auth];
	}).spread(db.storeRoom)
	.then(function(){
		res.redirect(utils.roomUrl(room));	
	}).catch(function(err){
		res.render('room.jade', { room: JSON.stringify(room), error: JSON.stringify(err.toString()) });
	}).finally(db.off);
}

exports.appGetRooms = function(req, res, db){
	db.on(+req.user.id)
	.then(function(uid){
		return [
			this.listFrontPageRooms(uid),
			this.fetchUserPingRooms(uid, 0)
		]
	}).spread(function(rooms, pings){
		rooms.forEach(function(r){ r.path = utils.roomPath(r) });
		res.render(utils.mobile(req) ? 'rooms.mob.jade' : 'rooms.jade', { rooms:rooms, pings:pings, user:req.user, langs:langs.legal });
	}).catch(function(err){
		utils.renderErr(res, err);
	}).finally(db.off);
}
