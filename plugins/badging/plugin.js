
const	path = require("path"),
	commands = {
		list: require("./command-list.js").doList,
		award: require("./command-award.js").doAward,
		ladder: require("./command-ladder.js").doLadder,
	},
	autoAwarder = require("./auto-awarder.js");

var	db;

exports.name = "badging";

exports.init = async function(miaou){
	db = miaou.db;
	await db.upgrade(exports.name, path.resolve(__dirname, 'sql'));
	autoAwarder.init(miaou)
}

exports.getBadgeByTagName = async function(con, tag, name){
	return await con.queryOptionalRow(
		"select * from badge where tag=$1 and name=$2",
		[tag, name],
		"badge_select_by_tag_name"
	);
}

exports.getBadgeCounts = async function(con, playerId){
	let rows = await con.queryRows(
		"select level, count(*) n from player_badge join badge on id=badge where player=$1 group by level",
		[playerId],
		"badge_player_counts"
	);
	return rows.reduce((c, r)=>{
		c[r.level] = r.n;
		return c;
	}, {});
}

exports.md = function(badge){
	return `[${badge.level}-badge:${badge.tag}/${badge.name}]`;
}

// return a new instance, saved in database if necessary and with id set
exports.initBadge = async function(con, badge){
	if (!/^\w+[\w\s-]+\w+$/.test(badge.name)) throw new Error("invalid badge name");
	if (!badge.tag) throw new Error("missing tag in badge");
	badge.manual = !!badge.manual;
	var dbBadge = await exports.getBadgeByTagName(con, badge.tag, badge.name);
	if (dbBadge) {
		if (
			badge.manual != dbBadge.manual
			|| badge.level != dbBadge.level
			|| badge.condition != dbBadge.condition
		) {
			dbBadge = await con.queryRow(
				"update badge set level=$2, manual=$3, condition=$4 where id=$1 returning *",
				[dbBadge.id, badge.level, badge.manual||false, badge.condition],
				"update_badge"
			);
		}
	} else {
		dbBadge = await con.queryRow(
			"insert into badge (tag, name, level, manual, condition)"+
			" values ($1, $2, $3, $4, $5) returning *",
			[badge.tag, badge.name, badge.level, badge.manual||false, badge.condition],
			"insert_badge"
		);
	}
	return dbBadge
}

// initialize the badge if necessary and register a check function for automated awarding
// options {
//  	badge: {tag, name, level, condition}
//  	checkPlayer: async function(con, player)
// }
exports.register = async function(con, options){
	try {
		options.badge = await exports.initBadge(con, options.badge);
		if (options.checkPlayer) autoAwarder.registerCheck(options);
		return true;
	} catch (e) {
		console.log("Error while creating badge:", e); // many possible causes, like a deleted tag
		return false;
	}
}

async function onCommand(ct){
	let	con = this,
		match = ct.args.match(/^\s*(\w+)?\s*(.*)$/),
		verb = match[1],
		args = match[2];
	var fun = commands[verb||"list"];
	if (!fun) throw new Error("Command not understood");
	if (verb==="award" && ct.private) throw new Error("Awarding a badge can't be private.");
	await fun(con, ct, args||"");
	ct.end()
}

exports.registerCommands = function(cb){
	cb({
		name: "badge",
		fun: onCommand,
		canBePrivate: true,
		help: "do things related to badges",
		detailedHelp:
			"Exemples: "+
			'\n `!!badge list Miaou` : list all badges related to the "Miaou" tag'+
			'\n `!!badge @someuser` : list all badges of a user'+
			'\n `!!badge list gold` : list all gold badges'+
			'\n `!!badge list bronze silver Miaou Tribo` : '+
			'list all silver and bronze badges related to the "Miaou" and "Tribo" tags.'
	});
}

exports.registerRoutes = map=>{
	map("get", /^\/json\/badge$/, function(req, res, next){
		res.setHeader("Cache-Control", "public, max-age=600"); // 10 minutes
		let	badgeTag = req.query.tag,
			badgeName = req.query.name;
		db.do(async function(con){
			let badge = await con.queryOptionalRow(
				"select *, (select count(*) from player_badge where badge=badge.id) awards"+
				" from badge where tag=$1 and name=$2",
				[badgeTag, badgeName],
				"badge_details_select_by_tag_name"
			);
			if (badge) res.json({badge});
			else res.json({error: "badge not found"});
		}, function(err){
			res.json({error: err.toString()});
		});
	});
}

exports.getPublicProfileAdditions = async function(con, user, room){
	let counts = await exports.getBadgeCounts(con, user.id);
	let html = "<div class=badge-counts>";
	;["gold", "silver", "bronze"].forEach(level=>{
		if (!counts[level]) return;
		html += `<span class=${level}-badge-count>${counts[level]}</span>`;
	});
	html += "</div>";
	return [{ html }];
}

exports.getUserPageAdditions = async function(con, user){
	let badges = await con.queryRows(
		"select * from player_badge join badge on badge=id where player=$1",
		[user.id],
		"list user badges"
	);
	let	tags = [],
		badgesByTag = new Map;
	badges.forEach(b=>{
		let arr = badgesByTag.get(b.tag);
		if (!arr) {
			tags.push(b.tag);
			arr = [];
			badgesByTag.set(b.tag, arr);
		}
		arr.push(b);
	});
	let html = tags.sort().map(tag=>
		`<h3>${tag}</h3>` + badgesByTag.get(tag).map(
			b=>`<span class=${b.level}-badge>${b.name}</span>`
		).join(" ")
	).join("\n");
	return [{
		title: "Badges",
		content: "<div class=badge-list>"+html+"</div>"
	}];
}
