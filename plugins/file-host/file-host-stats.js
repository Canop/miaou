
let fmt;

async function doStats(con, ct, options){
	let c = "File Hosting Statistics\n";
	if (options.usernames && options.usernames.length) {
		c += await doStats_usernames(con, options.usernames);
	} else if (options.params.includes('types')) {
		c += await doStats_toptypes(con, options.n);
	} else if (options.params.includes('users')) {
		c += await doStats_topusers(con, options.n);
	} else {
		c += await doStats_global(con);
	}
	ct.reply(c, ct.nostore = c.length>800);
}

exports.init = function(miaou){
	fmt = miaou.lib("fmt");
	let statsPlugin = miaou.plugin("stats");
	if (statsPlugin) {
		statsPlugin.registerStatsMaker("file-host", doStats);
	} else {
		console.log("stats plugin not available -> no stats for file-host");
	}
}

async function doStats_global(con){
	let row = await con.queryRow(
		"select count(id) n, count(distinct uploader) ups, sum(size) sumsize from hosted_file",
		[],
		"hosted_file / stats / global raw"
	);
	return fmt.tbl({
		cols: ["Files", "Uploaders", "Size Sum"],
		rows: [[fmt.int(row.n), fmt.int(row.ups), fmt.bytes(row.sumsize, 2)]],
	});
}

async function doStats_usernames(con, usernames){
	let rows = [];
	for (let username of usernames) {
		let user = await con.getUserByName(username);
		if (!user) throw new Error("User not found: " + username);
		let row = await con.queryRow(
			"select count(id) n, sum(size) sumsize from hosted_file where uploader=$1",
			[user.id],
			"hosted_file / stats / user"
		);
		rows.push([fmt.playerLink(user.name), fmt.int(row.n), fmt.bytes(row.sumsize, 2)]);
	}
	return fmt.tbl({
		cols: ["User", "Files", "Size Sum"],
		rows,
	});
}

async function doStats_topusers(con, n){
	let rows = await con.queryRows(
		"select uploader, (select name from player where id=uploader) username, count(id) n, sum(size) sumsize"+
		" from hosted_file group by uploader order by sumsize desc limit $1",
		[n||10],
		"hosted_file / stats / top users"
	);
	rows = rows.map(row => [fmt.playerLink(row.username), fmt.int(row.n), fmt.bytes(row.sumsize, 2)]);
	return fmt.tbl({
		cols: ["User", "Files", "Size Sum"],
		rows,
		rank: true,
	});
}

async function doStats_toptypes(con, n){
	let rows = await con.queryRows(
		"select ext, count(id) n, count(uploader) ups, sum(size) sumsize"+
		" from hosted_file group by ext order by sumsize desc limit $1",
		[n||10],
		"hosted_file / stats / top exts"
	);
	rows = rows.map(row => [row.ext, fmt.int(row.ups), fmt.int(row.n), fmt.bytes(row.sumsize, 2)]);
	return fmt.tbl({
		cols: ["Extension", "Users", "Files", "Size Sum"],
		rows,
		rank: true,
	});
}

