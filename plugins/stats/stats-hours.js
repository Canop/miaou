const {dedent} = require("../../libs/template-tags.js");
const fmt = require("../../libs/fmt.js");

// generate message histograms indexed on hours of the day.
// The result is a sorted array of {hour, nb}, with an entry per hour.
// Options:
// 	user: optional message author id
// 	room:  optional message room id
exports.rawData = async function(con, options){
	let conditions = [];
	if (options.user) conditions.push(["author", +options.user]);
	if (options.room) conditions.push(["room", +options.room]);
	let where = "";
	if (conditions.length) {
		where = `where ${conditions.map((c, i)=>c[0]+"=$"+(i+1)).join(" and ")}`;
	}
	let sql = dedent`
		with hours as (
			select generate_series(0, 23) as h
		),
		perhour as (
			select extract(hour from to_timestamp(created)) as h, count(*) n from message
			${where}
			group by h
		)
		select hours.h, coalesce(perhour.n, 0) n
		from hours
		left join perhour on perhour.h=hours.h
	`;
	return con.queryRows(sql, conditions.map(c=>c[1]), ["hours", "stats", ...conditions.map(c=>c[0])].join("_"));
}

// return the current hour computed the same way the histogram ones are
//  computed, so that the developper doesn't have to worry about timezone bugs
exports.currentHour = async function(con){
	return con.queryValue("select extract(hour from to_timestamp($1))", [Date.now()/1000|0], "current_hour");
}

// return a promise
exports.doStats = async function(con, ct, usernames, roomIds){
	let options = {};
	let title = "Messages per hour (UTC)";
	if (usernames && usernames.length) {
		if (usernames[0] !== ct.shoe.publicUser.name) {
			throw new Error("You can't query the hour histogram of another user");
		}
		options.user = ct.shoe.publicUser.id;
		title += ` for user @${ct.shoe.publicUser.name}`;
	}
	if (roomIds && roomIds.length) {
		if (roomIds[0] !== ct.shoe.room.id) {
			throw new Error("You can't query the hour histogram of another room");
		}
		options.room = ct.shoe.room.id;
		title += ` in the current room`;
	}
	let data = await exports.rawData(con, options);
	let currentHour = await exports.currentHour(con);
	let graphOptions = [
		"hideTable",
		`highlight-x:${currentHour}h`
	].join(",");
	let md = `## ${title}\n#graph(${graphOptions})\n` + fmt.tbl({
		cols: ["hour", "messages"],
		rows: data.map(({h, n})=>[h+"h", n])
	});
	ct.reply(md);
}

