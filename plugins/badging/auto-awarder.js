
const	checks = [],
	DELAY_BEFORE_START = 8 * 60 * 1000,
	//DELAY_BEFORE_START = 5 * 1000,
	DELAY_BETWEEN_GLOBAL_CHECKS = 7 * 60 * 60 * 1000;

var	db,
	ws,
	bench;

exports.init = function(miaou){
	db = miaou.db;
	bench = miaou.lib("bench");
	ws = miaou.lib("ws");
	setTimeout(callChecks, DELAY_BEFORE_START);
}


function mdBadge(badge){
	return `[${badge.level}-badge:${badge.tag}/${badge.name}]`;
}

function mdBadges(badges){
	if (badges.length===1) {
		return `the ${mdBadge(badges[0])} badge`;
	}
	var mds = badges.map(mdBadge);
	mds[mds.length-1] = "and " + mds[mds.length-1];
	return `the ${mds.join(", ")} badges`;
}

function callChecks(){
	db.do(async function(con){
		await exports.checkAll(con);
		setTimeout(callChecks, DELAY_BETWEEN_GLOBAL_CHECKS);
	}, function(err){
		console.log("Error in badging checks", err);
	});
}

exports.registerCheck = function(options){
	checks.push(options);
}

async function award(con, player, badges, bot, roomId){
	var content = `@${player.name} is awarded ${mdBadges(badges)}.`;
	var message = await ws.botSendMessage(con, bot, roomId, content);
	for (var i=0; i<badges.length; i++) {
		var badge = badges[i];
		await con.execute(
			"insert into player_badge (player, badge, message) values($1, $2, $3)",
			[player.id, badge.id, message.id],
			"insert_player_badge"
		);
	}
	await ws.pingUser.call(con, roomId, player.name, message.id, message.authorname, content);
}

exports.checkAll = async function(con){
	console.log("Badges : start check all");
	try {
		var bog = bench.start("badging / checkAll");
		// we first get the list of players having recently posted
		var t = (Date.now() - DELAY_BETWEEN_GLOBAL_CHECKS)/1000|0;
		var recentAuthors = await con.queryRows(
			"select distinct(author) from message where created>$1",
			[t],
			"badging_find_recent_players"
		);

		for (var i=0; i<recentAuthors.length; i++) {
			var p = await db.getUserById.call(con, recentAuthors[i].author);
			console.log("checking", p.name);
			var bop = bench.start("badging / check player");
			var playerBadges = await con.queryRows(
				"select badge from player_badge where player=$1",
				[p.id],
				"select_player_badge_ids"
			);
			var ownedBadgesIds = playerBadges.reduce((s, b) => s.add(b.badge), new Set);
			var awardedBadges = new Map; // awardRoom -> []
			for (var j=0; j<checks.length; j++) {
				var check = checks[j];
				if (ownedBadgesIds.has(check.badge.id)) {
					continue;
				}
				var boc = bench.start(`badging / check  ${check.badge.tag}/${check.badge.name}`);
				if (await check.checkPlayer(con, p)) {
					console.log(`${p.name} receives badge ${check.badge.tag}/${check.badge.name}`);
					var arr = awardedBadges.get(check.awardRoom);
					if (!arr) {
						awardedBadges.set(check.awardRoom, arr=[]);
					}
					arr.push(check.badge);
				}
				boc.end();
			}
			for (let [room, arr] of awardedBadges) {
				await award(con, p, arr, null, room);
			}
			bop.end();
		}

		bog.end();
	} catch (err) {
		console.log("Error while checking badges");
		console.error(err);
	}
	console.log("Badges : finish check all");
}
