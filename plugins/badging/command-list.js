
const	badging = require("./plugin.js");

//async function getAllBadges(con){
//	return await con.queryRows(
//		"select * from badge order by level desc",
//		null,
//		"list all badges"
//	);
//}

function mdBadgesByTag(badges){
	if (!badges.length) return "*no badge*";
	var	tags = [],
		badgesByTag = new Map;
	badges.forEach(b=>{
		var arr = badgesByTag.get(b.tag);
		if (!arr) {
			tags.push(b.tag);
			arr = [];
			badgesByTag.set(b.tag, arr);
		}
		arr.push(b);
	});
	return tags.sort().map(tag=>
		`[tag:${tag}] **Badges**\n` + badgesByTag.get(tag).map(badging.md).join(" ")
	).join("\n");
}

//async function listAllBadges(con){
//	var	badges = await getAllBadges(con);
//	return "# All badges\n" + mdBadgesByTag(badges);
//}

// !!badge list
// !!badge list all
// !!badge list Miaou/
// !!badge list bronze
// !!badge list Miaou
// !!badge list @dystroy
exports.doList = async function(con, ct, args){
	console.log('args:', args);
	var	tokens = args.match(/\S+/g),
		levels = [],
		userid,
		tags = [];
	for (var i=0; tokens && i<tokens.length; i++) {
		var	token = tokens[i],
			pingMatch = token.match(/^@(\w[\w-]{2,19})$/);
		if (pingMatch) {
			if (userid) {
				throw new Error("Only one user can be referenced in this command");
			}
			var user = await con.getUserByName(pingMatch[1]);
			if (user) userid = user.id;
			continue;
		}
		if (/bronze|silver|gold/i.test(token)) {
			levels.push(token);
			continue;
		}
		if (token.endsWith("/")) token = token.slice(0, -1);
		if (token.length>=3) tags.push(token);
	}
	var	sql = "select * from badge",
		conds = 0,
		params = [];
	if (userid) {
		sql += ", player_badge where player_badge.badge=badge.id and player=$1";
		params.push(userid);
		conds++;
	}
	if (levels.length) {
		sql += (conds ? " and" : " where") + " level in (" + levels.map(w=>`'${w}'`) + ")";
		conds++;
	}
	if (tags.length) {
		sql += (conds ? " and" : " where") + " tag in (" + tags.map(w=>`'${w}'`) + ")";
		conds++;
	}
	sql += " order by level desc";
	var badges = await con.queryRows(sql, params, "list badges", false);
	var c = mdBadgesByTag(badges);
	ct.reply(c, ct.nostore = c.length>800);
}
