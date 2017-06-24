// manage authorizations and bans

const	levels = ['read', 'write', 'admin', 'own'],
	naming = require('./naming.js'),
	server = require('./server.js'),
	ws = require('./ws.js');

var	serverAdmins,
	db;

exports.configure = function(miaou){
	serverAdmins = miaou.conf("serverAdmins")||[];
	db = miaou.db;
	startPeriodicAccessRequestCleaning(miaou);
	return this;
}

function startPeriodicAccessRequestCleaning(miaou){
	var maxAge = miaou.conf("cleaning-frequencies", "old-access-requests") || 2*60*60; // 2 hours
	var checkInterval = Math.max(10, Math.min(1000, maxAge/5|0));
	console.log('Periodic Access Request Cleaning: checkInterval:', checkInterval, 'maxAge:', maxAge);
	setInterval(function(){
		console.log("checking access requests");
		db.on().then(function(){
			var now = Date.now()/1000|0;
			return this.execute(
				"update access_request set denied=$1, deny_message=$2"
				+ " where denied is null and requested<$3",
				[now, "Access Request Too Old - Automatic Deletion", now-maxAge],
				"purge_old_access_requests", false
			);
		}).then(function(res){
			console.log("Removed", res.rowCount, "old access request(s)");
		}).finally(db.off);

	}, checkInterval*1000);
}


exports.checkAtLeast = function(auth, neededAuth){
	for (var i=levels.length; i-->0;) {
		if (levels[i]===auth) return true;
		if (levels[i]===neededAuth) return false;
	}
	return false;
}

exports.isServerAdmin = function(user){
	for (let idOrName of serverAdmins) {
		if (idOrName===user.id || idOrName===user.name) return true;
	}
	return false;
}

// handles GET of the auths /page
exports.appGetAuths = function(req, res){
	db.on([+req.query.id, +req.user.id])
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
	}).spread(function(auths, requests, recentUsers, bans, room){
		var dontlistasrecent = {}, unauthorizedUsers = [];
		auths.concat(requests).forEach(function(a){
			dontlistasrecent[a.player] = true;
		});
		recentUsers.forEach(function(u){
			if (!dontlistasrecent[u.id]) unauthorizedUsers.push(u);
		});
		res.render('auths.pug', {
			vars:{room},
			room, auths, requests, unauthorizedUsers, bans:bans
		});
	}).catch(db.NoRowError, function(){
		server.renderErr(res, "room not found");
	}).catch(function(err){
		server.renderErr(res, err);
	}).finally(db.off);
}

// handles POST of the auths /page
exports.appPostAuths = function(req, res){
	var room;
	db.on([+req.query.id, +req.user.id])
	.spread(db.fetchRoomAndUserAuth)
	.then(async function(r){
		room = r;
		var	author = req.user.name,
			messageLines = [];
		room.path = room.id+'?'+naming.toUrlDecoration(room.name);
		if (!exports.checkAtLeast(room.auth, 'admin')) {
			return server.renderErr(res, "Admin auth is required");
		}
		if (r.dialog) {
			return server.renderErr(res, "You can't change authorizations of a dialog room");
		}
		var m, modifiedUser, actions = [];
		for (var key in req.body) {
			if ((m = key.match(/^answer_request_(\d+)$/))) {
				var	accepted = req.body[key]==='grant',
					denyMessage = req.body['deny_message_'+m[1]];
				modifiedUser = await this.getUserById(+m[1]);
				if (accepted) {
					messageLines.push(`@${author} gave *write* right to @${modifiedUser.name}.`);
					actions.push({cmd:'insert_auth', auth:'write', user:modifiedUser.id});
					actions.push({cmd:'delete_ar', user:modifiedUser.id});
				} else {
					actions.push({cmd:'deny_ar', user:modifiedUser.id, message:denyMessage||''});
				}
				ws.emitAccessRequestAnswer(room.id, modifiedUser.id, accepted, denyMessage);
			} else if ((m = key.match(/^insert_auth_(\d+)$/))) {
				if (req.body[key]!='none') {
					modifiedUser = await this.getUserById(+m[1]);
					var auth = req.body[key];
					messageLines.push(`@${author} gave *${auth}* authorization to @${modifiedUser.name}.`);
					actions.push({cmd:'insert_auth', auth, user:modifiedUser.id});
				}
			} else if ((m = key.match(/^change_auth_(\d+)$/))) {
				var new_auth = req.body[key];
				modifiedUser = await this.getUserById(+m[1]);
				if (new_auth==='none') {
					actions.push({cmd:'delete_auth', user:modifiedUser.id});
					messageLines.push(`@${author} removed all rights of @${modifiedUser.name}.`);
					if (r.private) {
						ws.throwOut(modifiedUser.id, r.id, 'Your rights to this room have been revoked');
						ws.throwOut(modifiedUser.id, 'w'+r.id);
					}
				} else {
					messageLines.push(`@${author} changed rights of @${modifiedUser.name} to *${new_auth}*.`);
					actions.push({cmd:'update_auth', user:modifiedUser.id, auth:new_auth});
				}
			} else if ((m = key.match(/^unban_(\d+)_(\d+)$/))) {
				var banid = +m[1], banned = +m[2];
				actions.push({cmd:'unban', id:banid, user:banned});
				actions.push({cmd:'delete_ar', user:banned});
				ws.emitAccessRequestAnswer(room.id, banned, true);
			}
		}
		if (messageLines.length) {
			ws.botMessage(null, room.id, messageLines.join("\n"));
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

exports.wsOnBan = function(shoe, o){
	if (!shoe.room) return console.log('No room in wsOnBan');
	o.banner = shoe.publicUser.id;
	o.bannername = shoe.publicUser.name;
	db.on([shoe.room.id, o.banned])
	.spread(db.getAuthLevel)
	.then(function(obj){
		var bannedAuth = obj ? obj.auth : null;
		if (bannedAuth==="own") throw "A room owner cannot be banned";
		var bannerAuth = shoe.room.auth;
		if (bannedAuth==="admin" && bannerAuth!=="own") throw "Only a room owner can ban an admin";
		if (bannerAuth!=="admin" && bannerAuth!=="own") throw "Only an owner or an admin can ban a user";
		var now = Date.now()/1000|0;
		return this.insertBan(shoe.room.id, o.banned, now, now+o.duration, shoe.publicUser.id, o.reason);
	}).then(function(){
		shoe.emitToRoom('ban', o);
		ws.throwOut(o.banned, shoe.room.id, 'You have been banned from this room for ' + o.nb + ' ' + o.unit);
		ws.throwOut(o.banned, 'w'+shoe.room.id);
	}).catch(function(err){
		shoe.error('error in ban : '+err.toString());
	}).finally(db.off);
}
