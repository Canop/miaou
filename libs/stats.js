// !!stats command

const	fmt = require('./fmt.js'),
	naming = require('./naming.js'),
	monthstats = require('./stats-months.js'),
	siostats = require('./stats-sockets.js');

var	miaou;

exports.configure = function(_miaou){
	miaou = _miaou;
	monthstats.preloadCache(miaou.db);
	return this;
}

function fmtTag(_, name){
	return "[tag:"+name+"]";
}
function fmtPlayerName(_, name){
	var mdname = naming.makeMarkdownCompatible(name);
	if (!naming.isValidUsername(name)) return mdname;
	return "["+mdname+"](u/"+name+")";
}

function oneWeekBefore(){
	return (Date.now()/1000|0) - 7*24*60*60;
}

// Exemples of args:
//	 "sockets"
//	 "me"
//	 "user @someuser"
//	 "@someuser"
//	 "graph @someuser"
//	 "user-graph @someuser"
//	 "graph @someuser @someotheruser"
//	 "graph @someuser me @someotheruser"
// 	 "server"
//	 ""
// 	 "server-graph"
// 	 "graph server"
// 	 "graph"
// 	 "active-rooms 25"
// 	 "active-users"
// 	 "users 500"
// 	 "users"
// 	 "room"
// 	 "#3"
// 	 "graph #3"
// 	 "graph #3 #7"
// 	 "roomusers"
// 	 "roomusers 20"
// 	 "prefs"
// 	 "prefs beta"
// 	 "prefs theme 3"
// 	 "tags"
// 	 "votes"
// 	 "tzoffsets"
function doStats(ct){
	// regex parsing: (topic) (parameters) (n)
	var	params = ct.args.split(/[\s,]+/),
		n = 10,
		topic = /^@\S+/.test(params[0]) ? null : params.shift(),
		lastToken = params[params.length-1],
		room = ct.shoe.room,
		roomIds = [],
		usernames = [];
	if (lastToken==+lastToken) {
		n = Math.min(+lastToken, 500);
		params.pop();
	}

	roomIds = params.filter(p=>/^(#\d+|room)$/.test(p)).map(p => p=="room" ? room.id : +(p.slice(1)));
	params = params.map(n => /^me$/i.test(n) ? '@'+ct.username() : n);
	usernames = params.filter(p => naming.isPing(p)).map(p => p.slice(1));
	if (!topic) {
		if (usernames.length) topic = "user";
		else topic = "server";
	} else if (topic=="graph") {
		if (usernames.length) {
			topic = "user-graph";
		} else if (roomIds.length) {
			topic = "room-graph";
		} else {
			topic = "server-graph";
		}
	}

	if (/^socket/i.test(topic)) {
		return siostats.doStats(ct, miaou.io);
	}
	if (/^server-graph$/i.test(topic)) {
		return monthstats.doServerStats(this, ct);
	}
	if (/^user-graph$/i.test(topic)) {
		if (!usernames.length) throw "User stats need a ping as parameter";
		return monthstats.doUsersStats(this, ct, usernames);
	}
	if (/^room-graph$/i.test(topic)) {
		if (!roomIds.length) throw "Room stats need a id as parameter";
		return monthstats.doRoomsStats(this, ct, roomIds);
	}

	var	psname = "stats / " + topic,
		cols,
		from,
		title,
		args=[];
	if (/^server$/i.test(topic)) {
		cols = [
			{name:"Users", value:"(select count(*) from player where name is not null)"},
			{name:"Public Rooms", value:"(select count(*) from room where private=false)"},
			{name:"Private Rooms", value:"(select count(*) from room where private=true)"},
			{name:"Messages", value:"(select count(*) from message)"},
			{
				name:"Last Week Messages",
				value:"(select count(*) from message where created>extract(epoch from now())-604800)"
			},
		];
		title = "Server Statistics";
	} else if (/^active-users$/i.test(topic)) {
		cols = [
			{name:"Name", value:"(select name from player where player.id=pid)", fmt:fmtPlayerName},
			{name:"Messages", value:"(select count(*) from message where author=pid)"},
			{name:"Last Week Messages", value:"n"},
			{name:"Rooms", value:"(select count(distinct room) from message where author=pid)"},
		];
		from = "from (select author pid, count(*) n from message"
	       		+ " where created>$1 group by author order by n desc limit $2) s";
		args.push(oneWeekBefore());
		args.push(n);
		title = "Users Statistics (top "+n+")";
	} else if (/^users$/i.test(topic)) {
		cols = [
			{name:"Name", value:"(select name from player where player.id=pid)", fmt:fmtPlayerName},
			{name:"Messages", value:"n"},
			{name:"Last Week Messages", value:"(select count(*) n from message where created>$1 and author=pid)"},
			{name:"Rooms", value:"(select count(distinct room) from message where author=pid)"},
		];
		from = "from (select author pid, count(*) n from message group by author order by n desc limit $2) s";
		args.push(oneWeekBefore());
		args.push(n);
		title = "Users Statistics (top "+n+")";
	} else if (/^roomusers$/i.test(topic)) {
		cols = [
			{name:"Name", value:"(select name from player where player.id=pid)", fmt:fmtPlayerName},
			{name:"Room Messages", value:"n"},
			{
				name:"Last Week Room Messages",
				value:"(select count(*) n from message where room=$1 and created>$2 and author=pid)"
			},
			{name:"Total Messages", value:"(select count(*) from message where author=pid)"},
		];
		from = "from (select author pid, count(*) n from message"
			+ " where room=$1 group by author order by n desc limit $3) s";
		args.push(room.id, oneWeekBefore(), n);
		title = "Room Users Statistics (top "+n+")";
	} else if (/^user$/i.test(topic)) {
		if (!usernames.length) throw "User stats need a ping as parameter";
		cols = [
			{name:"Messages", value:"(select count(*) from message where author=player.id)"},
			{
				name:"Since",
				value:"(select min(created) from message where author=player.id)",
				fmt: (r, c) => fmt.date(c, "DD MMM YYYY")
			},
			{
				name:"Last Week Messages",
				value:"(select count(*) from message where created>$3 and author=player.id)"
			},
			{
				name:"Received Stars",
				value:"(select count(*) from message_vote, message"
			       		+ " where author=player.id and message_vote.message=message.id and vote='star')"
			},
			{name:"Given Stars", value:"(select count(*) from message_vote where player=player.id and vote='star')"},
			{name:"Messages In This Room", value:"(select count(*) from message where room=$2 and author=player.id)"},
			{name:"Rooms", value:"(select count(distinct room) from message where author=player.id)"},
		];
		from = "from player where name=$1";
		args.push(usernames[0], room.id, oneWeekBefore());
		title = "Statistics for user "+usernames[0];
	} else if (/^(active-)?rooms$/i.test(topic)) {
		cols = [
			{name:"Id", value:"id", fmt:row => row.c4 ? row.c0 : ' '},
			{name:"Name", value:"name", fmt:row => {
				var name = naming.makeMarkdownCompatible(row.c1);
				return row.c4 ? "["+name+"]("+row.c0+"#)" : name;
			}},
			{name:"Language", value:"lang"},
			{name:"Public", value:"private", fmt:(_, b) => b ? ' ' : '✓'},
			{name:"Listed", value:"listed", fmt:(_, b) => b ? '✓' : ' '},
			{name:"Messages", value:"(select count(*) from message where room=room.id)"},
			{name:"Last Week Messages", value:"(select count(*) from message where created>$1 and room=room.id)"},
			{name:"Users", value:"(select count(distinct author) from message where room=room.id)"},
		];
		var orderingCol = /^active-/i.test(topic) ? 6 : 5;
		from = "from room order by c"+orderingCol+" desc limit $2";
		args.push(oneWeekBefore(), n);
		title = "Rooms Statistics (top "+n+")";
	} else if (/^room$/i.test(topic)) {
		cols = [
			{name:"Messages", value:"(select count(*) from message where room=$1)"},
			{
				name:"Last Week Messages",
				value:"(select count(*) from message where created>extract(epoch from now())-604800 and room=$1)"
			},
			{name:"Users", value:"(select count(distinct author) from message where room=$1)"},
		];
		args.push(room.id);
		title = "Statistics of the room *"+room.name+"*";
	} else if (/^votes$/i.test(topic)) {
		cols = [
			{name:"Vote", value:"vote"},
			{name:"Number", value:"count(*)"},
		];
		from = "from message_vote group by vote order by c1 desc";
		title = "Voting Statistics";
	} else if (/^tzoffsets$/i.test(topic)) {
		cols = [
			{name:"Timezone Offset", value:"tzoffset", fmt:(_, tz) => tz==+tz ? tz : "unknown"},
			{name:"Number", value:"count(*)"},
		];
		from = "from player group by tzoffset order by c1 desc";
		title = "Timezones";
	} else if (/^tags$/i.test(topic)) {
		cols = [
			{name:"Name", value:"name", fmt:fmtTag},
			{name:"Rooms", value:"(select count(*) from room_tag where room_tag.tag=name)"},
		];
		from = "from tag order by c1 desc"
		if (params.length) {
			from += " where name=$1";
			args.push(params[0]);
			psname += " / specific";
		}
		title = "Tags Statistics";
	} else if (/^prefs$/i.test(topic)) {
		cols = [
			{name:"Name", value:"name"},
			{name:"Value", value:"value"},
			{name:"Number", value:"count(*)"},
		];
		from = "from pref"
		if (params.length) {
			from += " where name=$1";
			args.push(params[0]);
			psname += " / specific";
		}
		from += " group by name, value order by name, c2 desc";
		title = "Preferences Statistics";
	} else {
		throw "Wrong statistics request. Use `!!help stats` to learn about the possible uses";
	}
	var sql = "select " + cols.map((col, i) => (col.value||col.name)+' c'+i).join(',');
	if (from) sql += ' '+from;
	console.log("STATS", psname);


	return this.queryRows(sql, args, psname).then(function(rows){
		if (!rows.length) {
			return ct.reply("nothing", false);
		}
		var c = title+"\n";
		c += fmt.tbl({
			rank: true,
			cols: cols.map(col => col.name),
			rows: rows.map(row => cols.map(
				(col, i) => {
					var num = row['c'+i];
					return cols[i].fmt ? cols[i].fmt(row, num) : fmt.int(num);
				}
			))
		});
		ct.reply(c, ct.nostore = c.length>800);
	})
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name:'stats', fun:doStats,
		help:"Usage : `!!stats [server|me|@user|users|room|roomusers|rooms|votes|...] [n]`",
		detailedHelp: "Examples:"+
			"\n* `!!stats me` : some stats about you"+
			"\n* `!!stats users` : list of the users having posted the most messages"+
			"\n* `!!stats rooms 100` : list of the 100 rooms having the most messages"+
			"\n* `!!stats @someuser` : some stats about that user"+
			"\n* `!!stats active-rooms` : list of the rooms having the most messages in last week"+
			"\n* `!!stats active-users 20` : list of the 20 users having posted the most messages in the last week"+
			"\n* `!!stats prefs` : stats of user preferences"+
			"\n* `!!stats prefs theme` : stats of user preferences regarding themes"+
			"\n* `!!stats` : basic stats"+
			"\n* `!!stats server-graph` : monthly histogram"+
			"\n* `!!stats tzoffsets` : timezone offsets"+
			"\n* `!!stats sockets` : stats about current connections"

	});
}
