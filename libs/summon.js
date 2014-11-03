// !!summon command : pings a user and, if necessary, displays a notification bar with a "grant right" button

var db,
	bot;

exports.configure = function(miaou){
	db = miaou.db;
	bot = miaou.bot;
	return this;
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name:'summon',
		fun:function(ct){
			var shoe = ct.shoe;
			if (!(shoe.room.auth==='admin'||shoe.room.auth==='own')) throw "Only an admin can do that";
			var match = ct.text().match(/^!!summon\s+@(\w[\w_\-\d]{2,})(\b|$)/);
			if (!match) throw 'Bad syntax. Use `!!'+cmd+' @some_other_user`';
			var username=match[1];
			if (username===ct.username()) throw "You can't summon yourself";
			return this.getUserByName(username)
			.then(function(user){
				if (!user) throw 'User "'+username+'" not found';
				return [user, this.getAuthLevel(shoe.room.id, user.id)]
			})
			.spread(function(user, authLevel){
				if (!shoe.room.private) {
					return shoe.emitBotFlakeToRoom(bot, user.name+" has been notified of your wish he comes in this public room.", shoe.room.id);
				}
				if (authLevel) {
					return shoe.emitBotFlakeToRoom(bot, user.name+" has been notified of your wish he comes in this room (in which he has access).", shoe.room.id);				
				}
				shoe.emit('auth_dialog', {id:user.id, name:user.name});
			});
		},
		help:"bring a user in the room : `!!summon @some_user_name`",
		detailedHelp:"If you're an admin of the room, this is the best way to invite a user."
	});
}
