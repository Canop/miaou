const	Promise = require("bluebird"),
	fmt = require("../../libs/fmt.js"),
	bench = require("../../libs/bench.js");

var	cacheMonths = [],
	promisesWaitingForCacheMonths = null;


class Month{
	constructor(year, month){
		this.year = year;
		this.month = month; // 0 indexed
		this.n = 0;
	}
	static fromTime(time){
		var date = new Date(time*1000);
		return new Month(date.getUTCFullYear(), date.getUTCMonth());
	}
	next(){
		var	year = this.year,
			month = this.month + 1;
		if (month == 12) {
			month = 0;
			year++;
		}
		return new Month(year, month);
	}
	isNow(){
		var date = new Date();
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
	if (promisesWaitingForCacheMonths) {
		return new Promise(function(resolve){
			promisesWaitingForCacheMonths.push(resolve);
		});
	} else {
		promisesWaitingForCacheMonths = [];
	}
	var bo = bench.start("build_months");
	return con.queryRow("select id, created from message order by id limit 1", null, "first_message_in_db")
	.then(function(first){
		var	months = [],
			month = Month.fromTime(first.created);
		do {
			months.push(month);
			month = month.next();
		} while (!month.isNow());
		return Promise.all(months.map(function(m){
			return con.queryOptionalRow(
				"select min(id) minid, max(id) maxid, count(id) n, count(distinct author) authors"
				+ " from message where created>=$1 and created<$2",
				[m.startTime(), m.next().startTime()],
				"message_min_id_in_month"
			).then(function(row){
				if (!row) return;
				m.n = row.n;
				m.authors = row.authors;
				m.minId = row.minid;
				m.maxId = row.maxid;
			});
		}))
		.then(function(){
			bo.end();
			cacheMonths = months;
			var p;
			while ((p=promisesWaitingForCacheMonths.shift())) {
				p(months);
			}
			return months;
		});
	});
}

// returns a promise with an updated (if necessary) months array
function getMonths(con){
	if (!cacheMonths.length) {
		console.log("Initial build of cacheMonths for stats");
		return buildMonths(con);
	}
	if (!cacheMonths[cacheMonths.length-1].next().isNow()) {
		console.log("Update of cacheMonths for stats");
		return buildMonths(con);
	}
	console.log("cacheMonths already up to date");
	return Promise.resolve(cacheMonths);
}

exports.doServerStats = function(con, ct){
	// FIXME there's a risk several months computations are run in parallel (add a queue ?)
	return getMonths(con)
	.then(function(months){
		var c = "Server Statistics #graph(sum0)\n";
		c += fmt.tbl({
			cols: ["Month", "Messages", "Authors"],
			rows: months.map(m=>[m.label(), fmt.int(m.n), fmt.int(m.authors)])
		});
		ct.reply(c, ct.nostore = c.length>800);
	});
}

exports.doRoomsStats = function(con, ct, roomIds){
	return getMonths(con)
	.map(function(month){
		return Promise.map(roomIds, function(roomId){
			return con.queryOptionalRow(
				"select count(id) n from message"
				+ " where room=$1"
				+ " and created>=$2 and created<$3",
				[roomId, month.startTime(), month.next().startTime()],
				"room_messages_in_month"
			).then(function(row){
				return row.n;
			});
		}).then(function(roomstats){
			month.roomstats = roomstats;
			return month;
		});
	})
	.then(function(months){
		return Promise.map(roomIds, con.fetchRoom.bind(con)).then(function(rooms){
			var c = "Rooms Statistics #graph(compare,sum)\n";
			var rows = months
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

		});
	});
}

exports.doUsersStats = function(con, ct, usernames){
	return getMonths(con)
	.map(function(month){
		return Promise.map(usernames, function(username){
			return con.queryOptionalRow(
				"select count(id) n from message"
				+ " where author=(select id from player where name=$1)"
				+ " and created>=$2 and created<$3",
				[username, month.startTime(), month.next().startTime()],
				"user_messages_in_month"
			).then(function(row){
				return row.n;
			});
		}).then(function(userstats){
			month.userstats = userstats;
			return month;
		});
	})
	.then(function(months){
		var c = "Users Statistics #graph(compare,sum)\n";
		var rows = months
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
	});
}

exports.preloadCache = function(db){
	setTimeout(function(){
		db.on()
		.then(function(){
			return getMonths(this);
		})
		.finally(db.off);
	}, 3*60*1000);
}
