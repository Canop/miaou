// manage authorizations and bans

const	levels = ['read', 'write', 'admin', 'own'],
	naming = require('./naming.js'),
	server = require('./server.js'),
	prefs = require('./prefs.js'),
	ws = require('./ws.js');

let	serverAdminIds,
	miaou,
	db;

exports.configure = function(_miaou){
	miaou = _miaou;
	db = miaou.db;
	startPeriodicAccessRequestCleaning(miaou);
	return this;
}

exports.init = async function(){ // make miaou.lib async to avoid this ?
	serverAdminIds = new Set;
	await db.do(async function(con){
		for (let idOrName of miaou.conf("serverAdmins")||[]) {
			let user;
			if (typeof idOrName==="number") user = await con.getUserById(idOrName);
			else user = await con.getUserByName(idOrName);
			if (user) serverAdminIds.add(user.id);
		}
	});
	return this;
}

function startPeriodicAccessRequestCleaning(miaou){
	let maxAge = miaou.conf("cleaning-frequencies", "old-access-requests") || 2*60*60; // 2 hours
	let checkInterval = Math.max(10, Math.min(1000, maxAge/5|0));
	setInterval(function(){
		console.log("checking access requests");
		db.do(async function(con){
			let now = Date.now()/1000|0;
			let res = await con.execute(
				"update access_request set denied=$1, deny_message=$2"
				+ " where denied is null and requested<$3",
				[now, "Access Request Too Old - Automatic Deletion", now-maxAge],
				"purge_old_access_requests"
			);
			console.log("Removed", res.rowCount, "old access request(s)");
		});
	}, checkInterval*1000);
}


exports.checkAtLeast = function(auth, neededAuth){
	for (let i=levels.length; i-->0;) {
		if (levels[i]===auth) return true;
		if (levels[i]===neededAuth) return false;
	}
	return false;
}

exports.isServerAdmin = function(user){
	return serverAdminIds.has(user.id);
}

// handles GET of the auths /page
exports.appGetAuths = function(req, res){
	db.do(async function(con){
		let room;
		try {
			room = await con.fetchRoomAndUserAuth(+req.query.id, +req.user.id);
		} catch (err) {
			return server.renderErr(req, res, "room not found");
		}
		room.path = server.roomPath(room);
		let auths = await con.listRoomAuths(room.id);
		let requests = await con.listOpenAccessRequests(room.id);
		let recentUsers = await con.listRecentUsers(room.id, 50);
		let bans = await con.listActiveBans(room.id);
		let theme = await prefs.theme(con, req.user.id, req.query.theme, server.mobile(req));
		let dontlistasrecent = {};
		let unauthorizedUsers = [];
		auths.concat(requests).forEach(function(a){
			dontlistasrecent[a.player] = true;
		});
		recentUsers.forEach(function(u){
			if (!dontlistasrecent[u.id]) unauthorizedUsers.push(u);
		});
		res.render('auths.pug', {
			vars: {
				prefDefinitions: prefs.getDefinitions(),
				theme,
				room
			},
			room, auths, requests, unauthorizedUsers, bans
		});
	}, function(err){
		server.renderErr(req, res, err);
	});
}

// handles POST of the auths /page
exports.appPostAuths = function(req, res){
	db.do(async function(con){
		let room;
		try {
			room = await con.fetchRoomAndUserAuth(+req.query.id, +req.user.id);
		} catch (err) {
			return server.renderErr(req, res, "room not found");
		}
		room.path = room.id+'?'+naming.toUrlDecoration(room.name);
		let	author = req.user.name,
			messageLines = [];
		room.path = room.id+'?'+naming.toUrlDecoration(room.name);
		if (!exports.checkAtLeast(room.auth, 'admin')) {
			return server.renderErr(req, res, "Admin auth is required");
		}
		if (room.dialog) {
			return server.renderErr(req, res, "You can't change authorizations of a dialog room");
		}
		let	m,
			modifiedUser,
			actions = [];
		for (let key in req.body) {
			if ((m = key.match(/^answer_request_(\d+)$/))) {
				let	accepted = req.body[key]==='grant',
					denyMessage = req.body['deny_message_'+m[1]];
				modifiedUser = await con.getUserById(+m[1]);
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
					modifiedUser = await con.getUserById(+m[1]);
					let auth = req.body[key];
					messageLines.push(`@${author} gave *${auth}* authorization to @${modifiedUser.name}.`);
					actions.push({cmd:'insert_auth', auth, user:modifiedUser.id});
				}
			} else if ((m = key.match(/^change_auth_(\d+)$/))) {
				let new_auth = req.body[key];
				modifiedUser = await con.getUserById(+m[1]);
				if (new_auth==='none') {
					actions.push({cmd:'delete_auth', user:modifiedUser.id});
					messageLines.push(`@${author} removed all rights of @${modifiedUser.name}.`);
					if (room.private) {
						ws.throwOut(modifiedUser.id, room.id, 'Your rights to this room have been revoked');
						ws.throwOut(modifiedUser.id, 'w'+room.id);
					}
				} else {
					messageLines.push(`@${author} changed rights of @${modifiedUser.name} to *${new_auth}*.`);
					actions.push({cmd:'update_auth', user:modifiedUser.id, auth:new_auth});
				}
			} else if ((m = key.match(/^unban_(\d+)_(\d+)$/))) {
				let banid = +m[1], banned = +m[2];
				actions.push({cmd:'unban', id:banid, user:banned});
				actions.push({cmd:'delete_ar', user:banned});
				ws.emitAccessRequestAnswer(room.id, banned, true);
			}
		}
		if (messageLines.length) {
			ws.botMessage(null, room.id, messageLines.join("\n"));
		}
		await con.changeRights(actions, req.user.id, room);
		res.redirect(server.roomUrl(room));
	}, function(err){
		server.renderErr(req, res, err);
	});
}

exports.wsOnBan = async function(shoe, o){
	if (!shoe.room) return console.log('No room in wsOnBan');
	o.banner = shoe.publicUser.id;
	o.bannername = shoe.publicUser.name;
	await db.do(async function(con){
		if (exports.isServerAdmin(shoe.publicUser)) {
			console.log("ban launched by a server admin");
		} else {
			let row = await con.getAuthLevel(shoe.room.id, o.banned);
			let bannedAuth = row ? row.auth : null;
			if (bannedAuth==="own") throw "A room owner cannot be banned";
			let bannerAuth = shoe.room.auth;
			if (bannedAuth==="admin" && bannerAuth!=="own") throw "Only a room owner can ban an admin";
			if (bannerAuth!=="admin" && bannerAuth!=="own") throw "Only an owner or an admin can ban a user";
		}
		let now = Date.now()/1000|0;
		await con.insertBan(shoe.room.id, o.banned, now, now+o.duration, shoe.publicUser.id, o.reason);
		shoe.emitToRoom('ban', o);
		ws.throwOut(o.banned, shoe.room.id, 'You have been banned from this room for ' + o.nb + ' ' + o.unit);
		ws.throwOut(o.banned, 'w'+shoe.room.id);
	}, function(err){
		shoe.error('error in ban : '+err.toString());
	});
}
