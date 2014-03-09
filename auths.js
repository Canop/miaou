// manage authorizations

var levels = ['read', 'write', 'admin', 'own'],
	naming = require('./naming.js'),
	utils = require('./utils.js'),
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
		room.path = utils.roomPath(room);
		return [
			this.listRoomAuths(room.id),
			this.listOpenAccessRequests(room.id),
			this.listRecentUsers(room.id, 50),
			room
		];
	}).spread(function(auths, requests, recentUsers, room) {
		var authorizedUsers = {}, unauthorizedUsers = [];
		auths.forEach(function(a){
			authorizedUsers[a.player] = true;
		});
		recentUsers.forEach(function(u){
			if (!authorizedUsers[u.id]) unauthorizedUsers.push(u);
		});
		res.render('auths.jade', { room:room, auths:auths, requests:requests, unauthorizedUsers:unauthorizedUsers });
	}).catch(db.NoRowError, function(err){
		utils.renderErr(res, "room not found");
	}).catch(function(err){
		utils.renderErr(res, err);
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
			return renderErr(res, "Admin auth is required");
		}
		var m, actions = [];
		for (var key in req.body){
			if (m = key.match(/^answer_request_(\d+)$/)) {
				var accepted = req.body[key]==='grant', modifiedUserId = +m[1],
					denyMessage = req.body['deny_message_'+modifiedUserId];
				console.log('denyMessage:',denyMessage);
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
				if (new_auth==='none') actions.push({cmd:'delete_auth', user:modifiedUserId});
				else actions.push({cmd:'update_auth', user:modifiedUserId, auth:new_auth});
			}
		}
		return this.changeRights(actions, req.user.id, r);
	}).then(function(){
		res.redirect(utils.roomUrl(room));
	}).catch(db.NoRowError, function(err){
		utils.renderErr(res, "room not found");
	}).catch(function(err){
		utils.renderErr(res, err);
	}).finally(db.off);
}
