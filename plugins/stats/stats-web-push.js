// !!stats web-push command


exports.doStats = async function(con, ct, miaou){
	let wp = miaou.lib("web-push");
	let dedent = miaou.lib("template-tags").dedent;
	let fmt = miaou.lib("fmt");

	let c = '';

	c += '## Web-Push Subscriptions:\n';
	let sql = dedent`
		with subs as (
			select pings, created>$1 recent from web_push_subscription
		)
		select count(*), pings, recent from subs group by pings, recent
	`;
	let rows = await con.queryRows(
		sql,
		[Date.now()/1000-7*24*60*60|0],
		"web-push-subscriptions-stats"
	);
	c += fmt.tbl({
		cols: ["only alerts", "less than a week old", "count"],
		rows: rows.map(r => [
			r.pings ? "no" : "yes",
			r.recent ? "yes" : "no",
			r.count
		])
	});

	c += `\n## Web-Push Notifications since last start (${fmt.durationSince(miaou.startTime*1000)} ago):\n`;
	let stats = wp.getStats();
	c += fmt.tbl({
		cols: [" ", "pings", "alerts"],
		rows: Object.keys(stats.pings).map(k => [ k, stats.pings[k], stats.alerts[k] ])
	});

	ct.reply(c);
}

