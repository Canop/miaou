// generators of data for histograms of messages per hour, day, or month
let	dedent,
	fmt,
	graph;

exports.init = function(miaou){
	dedent = miaou.lib("template-tags").dedent;
	fmt = miaou.lib("fmt");
	graph = miaou.plugin("graph");
}

class PerTimeUnitStator{
	constructor(name, field, xvalues, formatX){
		this.name = name;
		this.field = field;
		this.xvalues = xvalues;
		this.formatX = formatX;
	}
	// The result is a sorted array of {hour, nb}, with an entry per hour.
	// Options:
	// 	user: optional message author id
	// 	room:  optional message room id
	async rows(con, options){
		let conditions = [];
		if (options.user) conditions.push(["author", +options.user]);
		if (options.room) conditions.push(["room", +options.room]);
		let where = "";
		if (conditions.length) {
			where = `where ${conditions.map((c, i)=>c[0]+"=$"+(i+1)).join(" and ")}`;
		}
		let sql = dedent`
			with perx as (
				select extract(${this.field} from to_timestamp(created)) as x, count(*) n from message
				${where}
				group by x
			)
			select xvalues.x, coalesce(perx.n, 0) n
			from unnest(array[${this.xvalues}]) with ordinality as xvalues(x, ix)
			left join perx on perx.x=xvalues.x
			order by ix
		`;
		return con.queryRows(
			sql,
			conditions.map(c=>c[1]),
			["stats", this.field, ...conditions.map(c=>c[0])].join("_"),
			"stats-messages-per-time-field"
		);
	}
	// return the current hour|day|month
	async current(con){
		return con.queryValue(
			`select extract(${this.field} from to_timestamp($1))`,
			[Date.now()/1000|0],
			`current_${this.field}`
		);
	}
	tableMarkdown(current, rows){
		return graph.pragma({
			hideTable: true,
			"highlight-x": this.formatX(current)
		}) + fmt.tbl({
			cols: [this.name, "messages"],
			rows: rows.map(({x, n})=>[this.formatX(x), n])
		});
	}
	async replyCommand(con, ct, usernames, roomIds){
		let options = {};
		let title = `Messages per ${this.name} (UTC)`;
		if (usernames && usernames.length) {
			if (usernames[0] !== ct.shoe.publicUser.name) {
				throw new Error("You can't query the time histogram of another user");
			}
			options.user = ct.shoe.publicUser.id;
			title += ` for user @${ct.shoe.publicUser.name}`;
		}
		if (roomIds && roomIds.length) {
			if (roomIds[0] !== ct.shoe.room.id) {
				throw new Error("You can't query the time histogram of another room");
			}
			options.room = ct.shoe.room.id;
			title += ` in the current room`;
		}
		let rows = await this.rows(con, options);
		let current = await this.current(con);
		let md = `${title}:\n${this.tableMarkdown(current, rows)}`;
		ct.reply(md);
	}
}

exports.stators = {
	hours: new PerTimeUnitStator(
		"hour", "hour",
		Array(24).fill().map((_, i)=>i),
		x => `${x}h`
	),
	days: new PerTimeUnitStator(
		"day", "dow",
		[1, 2, 3, 4, 5, 6, 0], // days in psql are sorted the American way instead of the ISO one
		x => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][x]
	),
	months: new PerTimeUnitStator(
		"month", "month",
		Array(12).fill().map((_, i)=>i+1), // months start at 1 in psql. I can't complain
		x => [
			"January", "February", "March", "April", "May", "June",
			"July", "August", "September", "October", "November", "December"
		][x-1]
	)
};
