const	Promise = require("bluebird"),
	fmt = require("../../libs/fmt.js"),
	bench = require("../../libs/bench.js");

let	cacheMonths = [],
	promisesWaitingForCacheMonths = [];

class Month{
	constructor(year, month){
		this.year = year;
		this.month = month; // 0 indexed
		this.n = 0;
	}
	static fromTime(time){
		let date = new Date(time*1000);
		return new Month(date.getUTCFullYear(), date.getUTCMonth());
	}
	next(){
		let	year = this.year,
			month = this.month + 1;
		if (month == 12) {
			month = 0;
			year++;
		}
		return new Month(year, month);
	}
	isNow(){
		let date = new Date();
		return date.getUTCFullYear()===this.year && date.getUTCMonth()===this.month;
	}
	// builds a canonical label like "2013/11" (UTC)
	label(){
		return this.year + (this.month < 9 ? "/0" : "/") + (this.month+1);
	}
	startTime(){
		return new Date(this.year, this.month).getTime()/1000 | 0;
	}
}

function buildMonths(con){
	return new Promise(async function(resolve){
		promisesWaitingForCacheMonths.push(resolve);
		if (promisesWaitingForCacheMonths.length>1) return;
		let bo = bench.start("build_months");
		let first = await con.queryRow(
			"select id, created from message order by id limit 1",
			null,
			"first_message_in_db"
		);
		let	months = [],
			month = Month.fromTime(first.created);
		do {
			months.push(month);
			let row = await con.queryOptionalRow(
				"select min(id) minid, max(id) maxid, count(id) n, count(distinct author) authors"+
				" from message where created>=$1 and created<$2",
				[month.startTime(), month.next().startTime()],
				"stats_in_month"
			);
			if (row) {
				month.n = row.n;
				month.authors = row.authors;
				month.minId = row.minid;
				month.maxId = row.maxid;
			}
			month = month.next();
		} while (!month.isNow());
		bo.end();
		console.log("setting value of cacheMonths");
		cacheMonths = months;
		let p;
		while ((p=promisesWaitingForCacheMonths.shift())) {
			p(months);
		}
	});
}

// returns a promise with an updated (if necessary) months array
async function getMonths(con){
	console.log("getMonths called on", new Date());
	if (!cacheMonths.length) {
		console.log("Initial build of cacheMonths for stats");
		return await buildMonths(con);
	}
	if (!cacheMonths[cacheMonths.length-1].next().isNow()) {
		console.log("Update of cacheMonths for stats");
		return await buildMonths(con);
	}
	console.log("cacheMonths already up to date");
	return cacheMonths;
}

exports.doServerStats = async function(con, ct){
	console.log("doServerStats months");
	let months = await getMonths(con);
	console.log("got", months.length, "months");
	let c = "Server Statistics #graph(sum0)\n";
	c += fmt.tbl({
		cols: ["Month", "Messages", "Authors"],
		rows: months.map(m=>[m.label(), fmt.int(m.n), fmt.int(m.authors)])
	});
	ct.reply(c, ct.nostore = c.length>800);
}

exports.doRoomsStats = async function(con, ct, roomIds){
	let months = await getMonths(con)
	for (let j=0; j<months.length; j++) {
		let month = months[j];
		month.roomstats = new Array(roomIds.length);
		for (var i=0; i<roomIds.length; i++) {
			let row = await con.queryOptionalRow(
				"select count(id) n from message"
				+ " where room=$1"
				+ " and created>=$2 and created<$3",
				[roomIds[i], month.startTime(), month.next().startTime()],
				"room_messages_in_month"
			);
			if (row) month.roomstats[i] = row.n;
		}
	}
	let rooms = new Array(roomIds.length);
	for (var i=0; i<roomIds.length; i++) {
		rooms[i] = await con.fetchRoom(roomIds[i]);
	}
	let c = "Rooms Statistics #graph(compare,sum)\n";
	let rows = months
	.filter(m =>{
		for (var i=m.roomstats.length; i--;) {
			if (m.roomstats[i]) return true;
		}
	})
	.map(m=>[m.label(), ...m.roomstats.map(v=>fmt.int(v))]);
	c += fmt.tbl({
		cols: ["Month", ...rooms.map(fmt.roomLink)],
		rows
	});
	ct.reply(c, ct.nostore = c.length>800);
}

exports.doUsersStats = async function(con, ct, usernames){
	let months = await getMonths(con);
	for (let j=0; j<months.length; j++) {
		let month = months[j];
		month.userstats = new Array(usernames.length);
		for (let i=0; i<usernames.length; i++) {
			let row = await con.queryOptionalRow(
				"select count(id) n from message"
				+ " where author=(select id from player where name=$1)"
				+ " and created>=$2 and created<$3",
				[usernames[i], month.startTime(), month.next().startTime()],
				"user_messages_in_month"
			);
			if (row) month.userstats[i] = row.n;
		}
	}
	let c = "Users Statistics #graph(compare,sum)\n";
	let rows = months
	.filter(m =>{
		for (var i=m.userstats.length; i--;) {
			if (m.userstats[i]) return true;
		}
	})
	.map(m=>[m.label(), ...m.userstats.map(v=>fmt.int(v))])
	c += fmt.tbl({
		cols: ["Month", ...usernames],
		rows
	});
	ct.reply(c, ct.nostore = c.length>800);
}

exports.preloadCache = function(db){
	setTimeout(function(){
		db.do(getMonths);
	}, 3*60*1000);
}
