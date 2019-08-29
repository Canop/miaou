
let	db,
	dedent,
	fmt;

exports.name = "user-rooms";

exports.init = async function(miaou){
	db = miaou.db;
	dedent = miaou.lib("template-tags").dedent;
	fmt = miaou.lib("fmt");
}

async function doCommand(ct){
	let sql = dedent`
	select r.id, r.name, r.private, r.listed, r.dialog, r.lang, a.auth,
	(select max(created) from message m where m.room = r.id) as lastcreated,
	(select max(created) from message m where m.room = r.id and m.author=$1) as mylastcreated,
	(select count(*) from message m where m.room = r.id) as count,
	(select count(*) from message m where m.room = r.id and m.author=$1) as mycount
	from room r left join room_auth a on a.room=r.id and a.player=$1
	where (
		(a.auth is not null)
		or
		(exists (select 1 from message m where m.room = r.id and m.author=$1))
	)
	`;
	await db.do(async function(con){
		let rows = await con.queryRows(sql, [ct.shoe.publicUser.id], "user-rooms / list");
		if (!rows.length) {
			return ct.reply("nothing", false);
		}
		let c = `Your ${rows.length} rooms:\n`;
		c += fmt.tbl({
			cols: [
				"id",
				"name",
				"private",
				"lang",
				"role",
				"messages",
				"yours",
				"activity",
				"yours",
			],
			rows: rows.map(row => [
				row.id,
				fmt.roomLink({id: row.id, name: row.name}),
				row.private ? '✓' : ' ',
				row.lang,
				row.auth,
				row.count,
				row.mycount,
				fmt.date(row.lastcreated, "YYYY/MM/DD"),
				fmt.date(row.mylastcreated, "YYYY/MM/DD"),
			])
		});
		ct.reply(c, ct.nostore = c.length>800);
		ct.end();
	});
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name: 'rooms',
		fun: doCommand,
		help: "list all my rooms",
		canBePrivate: true,
		detailedHelp: [
			"Answer with a table of all your rooms.",
			"Remember to call it as `!!!rooms` if you want this list to stay private."
		].join("\n")
	});
}
