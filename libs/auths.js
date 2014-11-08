// manage authorizations and bans

var levels = ['read', 'write', 'admin', 'own'],
	naming = require('./naming.js'),
	server = require('./server.js'),
	ws = require('./ws.js');

exports.checkAtLeast = function(auth, neededAuth) {
	for (var i=levels.length; i-->0;) {
		if (levels[i]===auth) return true;
		if (levels[i]===neededAuth) return false;
	}
	return false;
}

// handles GET of the auths /page
exports.appGetAuths = function(req, res, db){
	db.on([+req.param('id'), +req.user.id])
	.spread(db.fetchRoomAndUserAuth)
	.then(function(room){
		room.path = server.roomPath(room);
		return [
			this.listRoomAuths(room.id),
			this.listOpenAccessRequests(room.id),
			this.listRecentUsers(room.id, 50),
			this.listActiveBans(room.id),
			room
		];
	}).spread(function(auths, requests, recentUsers, bans, room) {
		var dontlistasrecent = {}, unauthorizedUsers = [];
		auths.concat(requests).forEach(function(a){
			dontlistasrecent[a.player] = true;
		});
		recentUsers.forEach(function(u){
			if (!dontlistasrecent[u.id]) unauthorizedUsers.push(u);
		});
		res.render('auths.jade', {
			room:room, auths:auths, requests:requests, unauthorizedUsers:unauthorizedUsers, bans:bans
		});
	}).catch(db.NoRowError, function(){
		server.renderErr(res, "room not found");
	}).catch(function(err){
		server.renderErr(res, err);
	}).finally(db.off);
}

// handles POST of the auths /page
exports.appPostAuths = function(req, res, db){
	var room; // todo find more elegant than storing as a variable in this scope
	db.on([+req.param('room'), +req.user.id])
	.spread(db.fetchRoomAndUserAuth)
	.then(function(r){
		room = r;
		room.path = room.id+'?'+naming.toUrlDecoration(room.name);
		if (!exports.checkAtLeast(room.auth, 'admin')) {
			return server.renderErr(res, "Admin auth is required");
		}
		var m, actions = [];
		for (var key in req.body){
			if (m = key.match(/^answer_request_(\d+)$/)) {
				var accepted = req.body[key]==='grant', modifiedUserId = +m[1],
					denyMessage = req.body['deny_message_'+m[1]];
				if (accepted) {
					actions.push({cmd:'insert_auth', auth:'write', user:modifiedUserId});
					actions.push({cmd:'delete_ar', user:modifiedUserId});
				} else {
					actions.push({cmd:'deny_ar', user:modifiedUserId, message:denyMessage||''});					
				}
				ws.emitAccessRequestAnswer(room.id, modifiedUserId, accepted, denyMessage);
			} else if (m = key.match(/^insert_auth_(\d+)$/)) {
				if (req.body[key]!='none') actions.push({cmd:'insert_auth', auth:req.body[key], user:+m[1]});
			} else if (m = key.match(/^change_auth_(\d+)$/)) {
				var new_auth = req.body[key], modifiedUserId = +m[1];
				if (new_auth==='none') {
					actions.push({cmd:'delete_auth', user:modifiedUserId});
					if (r.private) {
						ws.throwOut(modifiedUserId, r.id, 'Your rights to this room have been revoked');
					}
				} else {
					actions.push({cmd:'update_auth', user:modifiedUserId, auth:new_auth});
				}
			} else if (m = key.match(/^unban_(\d+)_(\d+)$/)) {
				var banid = +m[1], banned = +m[2];
				actions.push({cmd:'unban', id:banid, user:banned});
				actions.push({cmd:'delete_ar', user:banned});
				ws.emitAccessRequestAnswer(room.id, banned, true);
			}
		}
		return this.changeRights(actions, req.user.id, r);
	}).then(function(){
		res.redirect(server.roomUrl(room));
	}).catch(db.NoRowError, function(){
		server.renderErr(res, "room not found");
	}).catch(function(err){
		server.renderErr(res, err);
	}).finally(db.off);
}

exports.wsOnBan = function(shoe, db, o){
	if (!shoe.room) return console.log('No room in wsOnBan');
	o.banner = shoe.publicUser.id;
	o.bannername = shoe.publicUser.name;
	db.on([shoe.room.id, o.banned])
	.spread(db.getAuthLevel)
	.then(function(bannedAuth){
		if (bannedAuth==="own") throw "A room owner cannot be banned";
		var bannerAuth = shoe.room.auth;
		if (bannedAuth==="admin" && bannerAuth!=="own") throw "Only a room owner can ban an admin";
		if (bannerAuth!=="admin" && bannerAuth!=="own") throw "Only an owner or an admin can ban a user"; // should not happen
		var now = Date.now()/1000|0;
		return this.insertBan(shoe.room.id, o.banned, now, now+o.duration, shoe.publicUser.id, o.reason); 
	}).then(function(){
		shoe.emitToRoom('ban', o);
		ws.throwOut(o.banned, shoe.room.id, 'You have been banned from this room for ' + o.nb + ' ' + o.unit);
	}).catch(function(err){
		shoe.error('error in ban : '+err.toString());
	}).finally(db.off);
}
