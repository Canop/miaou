
const	path = require("path"),
	doList = require("./command-list.js").doList,
	doAward = require("./command-award.js").doAward,
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
	var rows = await con.queryRows(
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
	var dbBadge = await exports.getBadgeByTagName(con, badge.tag, badge.name);
	// TODO update other fields if necessary
	if (!dbBadge) {
		dbBadge = await con.queryRow(
			"insert into badge (tag, name, level, manual, condition)"+
			" values ($1, $2, $3, $4, $5) returning *",
			[badge.tag, badge.name, badge.level, badge.manual||false, badge.condition],
			"insert_badge",
			false
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
	var	con = this,
		match = ct.args.match(/^\s*(\w+)?\s*(.*)$/),
		verb = match[1],
		args = match[2];
	if (!verb || verb==="list") {
		return await doList(con, ct, args||"");
	}
	if (verb==="award") {
		return await doAward(con, ct, args||"");
	}
	throw new Error("Command not understood");
}

exports.registerCommands = function(cb){
	cb({
		name: "badge",
		fun: onCommand,
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
		res.setHeader("Cache-Control", "public, max-age=60000"); // 60 minutes
		var	badgeTag = req.query.tag,
			badgeName = req.query.name;
		db.on()
		.then(function(){
			return this.queryOptionalRow(
				"select *, (select count(*) from player_badge where badge=badge.id) awards"+
				" from badge where tag=$1 and name=$2",
				[badgeTag, badgeName],
				"badge_details_select_by_tag_name"
			);
		})
		.then(function(badge){
			res.json({badge});
		})
		.catch(function(err){
			res.json({error: err.toString()});
		})
		.finally(db.off);
	});
}

exports.getPublicProfileAdditions = async function(con, user, room){
	var counts = await exports.getBadgeCounts(con, user.id);
	var html = "<div class=badge-counts>";
	;["gold", "silver", "bronze"].forEach(level=>{
		if (!counts[level]) return;
		html += `<span class=${level}-badge-count>${counts[level]}</span>`;
	});
	html += "</div>";
	return [{ html }];
}
