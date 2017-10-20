
// handle commands like
// !!badge award Roulette / Dragon Slayer @meow

const	auths = require('../../libs/auths.js'),
	db = require('../../libs/db.js'),
	badging = require("./plugin.js");

exports.doAward = async function(con, ct, args){
	if (!auths.isServerAdmin(ct.shoe.completeUser)) {
		throw new Error("Only a server admin can award a badge");
	}
	var match = args.match(
		// yes this regex is horrible. Have a prettier idea?
		/^\s*(?:([\w- ]+?)\s*\/\s*([\w- ]+?))?\s*@(\w[\w-]{2,19})\s*(?:([\w- ]+?)\s*\/\s*([\w- ]+?))?$/
	);
	if (!match) throw new Error("Invalid arguments");
	var	username = match[3],
		badgetag = match[1]||match[4],
		badgename = match[2]||match[5];
	if (!badgetag) throw new Error("missing badge reference");
	var badge = await badging.getBadgeByTagName(con, badgetag, badgename);
	if (!badge) throw new Error(`Badge not found: ${badgetag} / ${badgename}`);
	var user = await con.getUserByName(username);
	if (!user) throw new Error("User not found");
	var exists = await con.queryValue(
		"select exists (select * from player_badge where badge=$1 and player=$2)",
		[badge.id, user.id],
		"player badge exists"
	);
	if (exists) throw new Error("Badge already awarded");
	ct.reply(`@${user.name} is awarded the [${badge.level}-badge:${badgetag}/${badgename}] badge`);
	ct.withSavedMessage = function(_, message){
		return db.on()
		.then(function(){
			return con.execute(
				"insert into player_badge (player, badge, message) values($1, $2, $3)",
				[user.id, badge.id, message.id],
				"insert_player_badge"
			);
		})
		.catch(function(e){
			console.error(e);
		})
		.finally(db.off);
	};
}
