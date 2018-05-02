const	dedent = require("../../libs/template-tags.js").dedent,
	badging = require("./plugin.js"),
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

// only applicable to the tag+name case
async function getRecipientsMd(con, badge, max){
	let count = await con.queryValue(
		"select count(*) from player_badge where badge=$1",
		[badge.id],
		"count_badge_awards"
	);
	let c = `The ${badging.md(badge)} badge has been awarded to ${count} user${count>1?"s":""}`;
	if (count && count<max) {
		c += ":\n";
		let playernames = await con.queryRows(
			"select name from player_badge join player on player.id=player where badge=$1 order by message",
			[badge.id],
			"list_badge_players"
		);
		c += fmt.oxford(playernames.map(r=>"@"+r.name));
	}
	return c;
}

// !!badge ladder
// !!badge ladder Tribo
// !!badge ladder Tribo / Champion
// !!badge ladder Tribo / Champion 100
exports.doLadder = async function(con, ct, args){
	let [, tagname, name, max] = args.match(/^\s*([^\/]+?\S)?\s*(?:\/\s*(.*?)\s*)?(?:\s*(\d+)\s*)?$/);
	if (!(max>=1 && max<=5000)) max = 50;
	if (tagname) {
		let tag = await con.getTag(tagname);
		if (!tag) {
			throw new Error(`No tag found with name "${tagname}"`);
		}
		tagname = tag.name; // might fix an invalid case in user query
	}
	let c = "";
	if (name) {
		var badge = await badging.getBadgeByTagName(con, tagname, name);
		if (!badge) throw new Error(`No ${tagname} / ${name} badge found̀`);
		c += await getRecipientsMd(con, badge, max);
	} else {
		c += await getLadderMd(con, tagname);
		c += await getLastToGetMd(con, tagname);
	}
	ct.reply(c, ct.nostore = true);
	ct.end("ladder");
}


