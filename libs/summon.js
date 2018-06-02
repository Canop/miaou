// !!summon command : pings a user and, if necessary, displays a notification bar with a "grant right" button

const	ws = require('./ws.js');

let	bot,
	db;

exports.configure = function(miaou){
	bot = miaou.bot;
	db = miaou.db;
	return this;
}

function summon(ct){
	let	room = ct.shoe.room,
		summoner = ct.user();
	ct.shoe.checkAuth('admin');
	let matches = ct.args.match(/@(\w[\w_\-\d]{2,})/g);
	if (!matches) throw new Error('Bad syntax. Use `!!summon @some_other_user`');
	if (!room.private) return; // nothing to do in a public room
	ct.withSavedMessage = function(shoe, message){
		console.log("in withSavedMessage");
		db.do(async function(con){
			for (let ping of matches) {
				let user = await con.getUserByName(ping.slice(1));
				if (!user || user.id==summoner.id) continue;
				let authLevel = await con.getAuthLevel(room.id, user.id);
				if (authLevel) {
					ws.botMessage(bot, room.id, user.name+" has been invited to this room.");
				} else {
					shoe.emit('auth_dialog', {
						user: {id:user.id, name:user.name},
						pingId: message.id,
						pingContent: "You have been summoned by @"+summoner.name
					});
				}
			}
		});
	};
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name: 'summon',
		fun: summon,
		help: "bring a user in the room : `!!summon @some_user_name`",
		detailedHelp: "If you're an admin of the room, this is the best way to invite a user (or several ones).",
		filter: room => !room.dialog
	});
}
