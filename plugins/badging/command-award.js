// handle commands like
// !!badge award Roulette / Dragon Slayer @meow @dystroy

const	auths = require('../../libs/auths.js'),
	db = require('../../libs/db.js'),
	fmt = require('../../libs/fmt.js'),
	badging = require("./plugin.js");

exports.doAward = async function(con, ct, args){
	if (!auths.isServerAdmin(ct.shoe.completeUser)) {
		throw new Error("Only a server admin can award a badge");
	}
	var pings = [];
	var usernames = [];
	var badgeRef = args.replace(/@(\w[\w-]{2,19})\b/g, function(ping, username){
		pings.push(ping);
		usernames.push(username);
		return "";
	}).split("/");
	if (!usernames.length) throw new Error("No ping in award command");
	if (badgeRef.length!=2) throw new Error("Badge reference not understood");
	var	badgetag = badgeRef[0].trim(),
		badgename = badgeRef[1].trim();
	var badge = await badging.getBadgeByTagName(con, badgetag, badgename);
	if (!badge) throw new Error(`Badge not found: ${badgetag} / ${badgename}`);
	var users = [];
	for (var username of usernames) {
		var user = await con.getUserByName(username);
		if (!user) throw new Error("User not found: " + username);
		var exists = await con.queryValue(
			"select exists (select * from player_badge where badge=$1 and player=$2)",
			[badge.id, user.id],
			"player badge exists"
		);
		if (exists) throw new Error("Badge already awarded to " + user.name);
		users.push(user);
	}
	ct.reply(`The [${badge.level}-badge:${badgetag}/${badgename}] badge is awarded to ${fmt.oxford(pings)}`);
	ct.withSavedMessage = function(_, message){
		db.do(async function(con){
			for (var user of users) {
				await con.execute(
					"insert into player_badge (player, badge, message) values($1, $2, $3)",
					[user.id, badge.id, message.id],
					"insert_player_badge"
				);
			}
			ct.end("award");
		}, function(err){
			console.log("err:", err);
		});
	};
}
