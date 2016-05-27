// !!summon command : pings a user and, if necessary, displays a notification bar with a "grant right" button

const	Promise = require("bluebird");
var	bot;

exports.configure = function(miaou){
	bot = miaou.bot;
	return this;
}

function summon(ct){
	var shoe = ct.shoe;
	shoe.checkAuth('admin');
	var matches = ct.args.match(/@(\w[\w_\-\d]{2,})/g);
	if (!matches) throw 'Bad syntax. Use `!!summon @some_other_user`';
	return Promise.resolve(matches)
	.map(ping => this.getUserByName(ping.slice(1)))
	.filter(user => user && user.id!==ct.user().id)
	.map(user => {
		if (!shoe.room.private) {
			return shoe.botMessage(bot, user.name+" has been invited to this public room.");
		}
		return this.getAuthLevel(shoe.room.id, user.id)
		.then(authLevel => {
			if (authLevel) {
				return shoe.botMessage(user.name+" has been invited to this room.");
			}
			shoe.emit('auth_dialog', {id:user.id, name:user.name});
		})
	});
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
