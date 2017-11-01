const	dedent = require("../../libs/template-tags.js").dedent,
	fmt = require("../../libs/fmt.js");

// applicable to global ladder (no tag) or a specific tag
async function getLadderMd(con, tag){
	let psname = "badge_ladder";
	let params = [];
	let condition = "";
	if (tag) {
		condition = "where tag=$1";
		params.push(tag);
		psname += "_tag";
	}
	let sql = dedent`
		select
			player,
			(select name from player where player.id=player) playername,
			count(*) filter (where level='gold') gold,
			count(*) filter (where level='silver') silver,
			count(*) filter (where level='bronze') bronze
		from player_badge join badge on player_badge.badge = badge.id
		${condition}
		group by player order by gold desc, silver desc, bronze desc limit 20`;
	let scores = await con.queryRows(sql, params, psname);
	let c = "## Ladder\n";
	if (scores.length) {
		c += "#|User|Gold|Silver|Bronze\n";
		c += "-|-|-|-|-\n";
		for (let i=0; i<scores.length; i++) {
			let s = scores[i];
			c += `${i+1}|@${s.playername}|${s.gold}|${s.silver}|${s.bronze}\n`;
		}
	} else {
		c += "No badge awarded.";
	}
	return c;
}

// applicable to global (no tag) or a specific tag
async function getLastToGetMd(con, tag){
	let psname = "badge_last_awards";
	let params = [];
	let condition = "";
	if (tag) {
		condition = "where tag=$1";
		params.push(tag);
		psname += "_tag";
	}
	let sql = dedent`
		select
			pb.tag,
			pb.name badgename,
			pb.level,
			player.name playername,
			pb.message
		from (
			select player, badge.tag, badge.name, badge.level, message
			from player_badge
			join badge on player_badge.badge=badge.id
			${condition}
			order by message desc
			limit 20
		) pb
		join player on pb.player=player.id`;
	let lastAwards = await con.queryRows(sql, params, psname);
	if (!lastAwards.length) return "";
	let c = "## Badges Recently Awarded\n";
	var badgePlayers = new Map; // badge->players
	lastAwards.forEach(a=>{
		var badge = `[${a.level}-badge:${a.tag}/${a.badgename}]`;
		var players = badgePlayers.get(badge);
		if (!players) badgePlayers.set(badge, players=[]);
		players.push(`@${a.playername}`);
	});
	for (let [badge, players] of badgePlayers) {
		c += `${badge} was awarded to ${fmt.oxford(players)}\n`;
	}
	return c;

}

// !!badge ladder
// !!badge ladder Tribo
// !!badge ladder Tribo / Champion
exports.doLadder = async function(con, ct, args){
	let [, tag, name] = args.match(/^\s*([^\/]+)?\s*(?:\/\s*(.*?)\s*)?$/);
	console.log('name:', name);
	let c = "";
	if (!name) {
		c += await getLadderMd(con, tag);
		c += await getLastToGetMd(con, tag);
	} else {
		c += "Command not yet implemented as is";
	}
	ct.reply(c, ct.nostore = true);
}


