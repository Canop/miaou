// !!ban command : just asks the browser to open the moderation dialog

exports.configure = function(miaou){
	return this;
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name: 'ban',
		fun: function(ct){
			var	shoe = ct.shoe;
			shoe.checkAuth('admin');
			var match = ct.args.match(/@(\w[\w_\-\d]{2,})/);
			if (!match) throw 'Bad syntax. Use `!!ban @some_other_user`';
			var username=match[1];
			if (username===ct.username()) throw "You can't ban yourself";
			return this.getUserByName(username)
			.then(function(user){
				if (!user) throw 'User "'+username+'" not found';
				return [user, this.getAuthLevel(shoe.room.id, user.id)]
			})
			.spread(function(user, authLevel){
				if (authLevel==="own") {
					throw "You can't ban a room owner";
				}
				if (authLevel==="admin" && shoe.room.auth!=="own") {
					throw "Only a room owner can ban a room admin";
				}
				shoe.emit('mod_dialog', {id:user.id, name:user.name});
			})
		},
		help: "Temporarily ban a user from the room : `!!ban @some_user_name`",
		detailedHelp: "A dialog will open to ask you the ban duration",
		filter: room => !room.dialog
	});
}
