// !!stats command

const	fmt = require('./fmt.js'),
	naming = require('./naming.js'),
	siostats = require('./stats-sockets.js');

var	miaou;

exports.configure = function(_miaou){
	miaou = _miaou;
	return this;
}

function raw(_, num){
	return num ? ''+num : ' ';
}

function fmtPlayerName(_, name){
	var mdname = naming.makeMarkdownCompatible(name);
	if (!naming.isValidUsername(name)) return mdname;
	return "["+mdname+"](u/"+name+")";
}

function sqlMonth(col){
	return `extract(year from to_timestamp(${col}))*100+extract(month from to_timestamp(${col}))`;
}
function fmtMonth(row){
	var c0 = ''+row.c0;
	return c0.slice(0, 4)+"/"+c0.slice(-2);
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
// 	 "roomusers"
// 	 "roomusers 20"
// 	 "prefs"
// 	 "prefs beta"
// 	 "prefs theme 3"
// 	 "votes"
function doStats(ct){
	// regex parsing: (topic) (parameters) (n)
	var	match = ct.args.match(/^([\w-]+)?\s*(.*?)\s*(\d+)?$/),
		topic = match[1],
		params = match[2].split(/[\s,]+/),
		n = Math.min(+match[3]||10, 500),
		ranking = true,
		usernames = [],
		hasLimit = false;
		
	params = params.map(n => /^me$/i.test(n) ? '@'+ct.username() : n);
	usernames = params.filter(p => naming.isPing(p)).map(p => p.slice(1));
	if (!topic) {
		if (usernames.length) topic = "user";
		else topic = "server";
	} else if (topic=="graph") {
		if (usernames.length) topic = "user-graph";
		else topic = "server-graph";
	}
	if (/^socket/i.test(topic)) {
		return siostats.doStats(ct, miaou.io);
	}
	var	psname = "stats / " + topic,
		cols,
		from,
		title,
		room = ct.shoe.room,
		orderingCol,
		args=[];
	/* eslint-disable max-len */
	if (/^server$/i.test(topic)) {
		cols = [
			{name:"Users", value:"(select count(*) from player where name is not null)"},
			{name:"Public Rooms", value:"(select count(*) from room where private=false)"},
			{name:"Private Rooms", value:"(select count(*) from room where private=true)"},
			{name:"Messages", value:"(select count(*) from message)"},
			{name:"Last Two Days Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800)"},
		];
		title = "Server Statistics";
	} else if (/^server-graph$/i.test(topic)) {
		cols = [
			{name:"Month", value:sqlMonth("created"), fmt:fmtMonth},
			{name:"Messages", value:"count(*)", fmt:raw},
			{name:"Authors", value:"count(distinct author)", fmt:raw},
		];
		from = "from message group by c0 order by c0";
		title = "Server Statistics #graph(sum0)";
		ranking = false;
	} else if (/^user-graph$/i.test(topic)) {
		if (!usernames.length) throw "User stats need a ping as parameter";
		if (usernames.length===1) {
			cols = [
				{name:"Month", value:sqlMonth("created"), fmt:fmtMonth},
				{name:"Messages", value:"count(*)", fmt:raw},
			];
			from = "from message where author=(select id from player where name=$1) group by c0 order by c0";
			args.push(usernames[0]);
		} else {
			usernames = usernames.slice(0, 4);
			psname += " / " + usernames.length;
			cols = [{name:"Month", value:"month", fmt:fmtMonth}].concat(usernames.map((name, i) => ({
				name,
				value:`(select count(*) from message m${i} where `+sqlMonth(`m${i}.created`)+`=month and author=(select id from player where name=$${i+1}))`
			})));
			from = "from (select "+sqlMonth("created")+" as month from message group by month order by month) as months";
			[].push.apply(args, usernames);
		}
		title = "User Statistics #graph(compare,sum)";
		ranking = false;
	} else if (/^(active-)?users$/i.test(topic)) {
		cols = [
			{name:"Name", value:"name", fmt:fmtPlayerName},
			{name:"Messages", value:"(select count(*) from message where author=player.id)"},
			{name:"Last Two Days Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800 and author=player.id)"},
			{name:"Stars", value:"(select sum(star) from message where author=player.id)"},
			{name:"Rooms", value:"(select count(distinct room) from message where author=player.id)"},
		];
		orderingCol = /^active-/i.test(topic) ? 2 : 1;
		from = "from player where name is not null order by c"+orderingCol+" desc";
		hasLimit = true;
		title = "Users Statistics (top "+n+")";
	} else if (/^roomusers$/i.test(topic)) {
		cols = [
			{name:"Name", value:"name", fmt:fmtPlayerName},
			{name:"Room Messages", value:"(select count(*) from message where author=player.id and room=$1)"},
			{name:"Last Two Days Room Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800 and author=player.id and room=$1)"},
			{name:"Stars", value:"(select count(*) from message_vote, message where author=player.id and message_vote.message=message.id and vote='star' and room=$1)"},
			{name:"Total Messages", value:"(select count(*) from message where author=player.id)"},
		];
		from = "from player where exists(select id from message where author=player.id and room=$1) order by c1 desc";
		hasLimit = true;
		args.push(room.id);
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
			{name:"Last Two Days Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800 and author=player.id)"},
			{name:"Received Stars", value:"(select count(*) from message_vote, message where author=player.id and message_vote.message=message.id and vote='star')"},
			{name:"Given Stars", value:"(select count(*) from message_vote where player=player.id and vote='star')"},
			{name:"Messages In This Room", value:"(select count(*) from message where room=$2 and author=player.id)"},
			{name:"Rooms", value:"(select count(distinct room) from message where author=player.id)"},
		];
		from = "from player where name=$1";
		args.push(usernames[0], room.id);
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
			{name:"Last Two Days Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800 and room=room.id)"},
			{name:"Users", value:"(select count(distinct author) from message where room=room.id)"},
		];
		orderingCol = /^active-/i.test(topic) ? 6 : 5;
		from = "from room order by c"+orderingCol+" desc";
		hasLimit = true;
		title = "Rooms Statistics (top "+n+")";
	} else if (/^room$/i.test(topic)) {
		cols = [
			{name:"Messages", value:"(select count(*) from message where room=$1)"},
			{name:"Last Two Days Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800 and room=$1)"},
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
		} else {
			ranking=false;
		}
		from += " group by name, value order by name, c2 desc";
		hasLimit = true;
		title = "Preferences Statistics";
	} else {
		throw "Wrong statistics request. Use `!!help stats` to learn about the possible uses";
	}
	var sql = "select " + cols.map((col, i) => (col.value||col.name)+' c'+i).join(',');
	if (from) sql += ' '+from;
	if (hasLimit) {
		args.push(n);
		sql += ' limit $' + args.length;
	}
	console.log("stats", psname);

	/* eslint-enable max-len */

	return this.queryRows(sql, args, psname).then(function(rows){
		var c;
		if (!rows.length) {
			c = "nothing found";
		} else {
			ranking = ranking && rows.length>1;
			c = title+"\n";
			if (ranking) c += '#|';
			c += cols.map(c => c.name).join('|')+'\n';
			if (ranking) c += '-:|';
			c += cols.map(()=> ':-:').join('|')+'\n';
			c += rows.map(function(row, l){
				var line='';
				if (ranking) line += l+1+'|';
				for (var i=0; i<cols.length; i++) {
					var num = row['c'+i];
					line += ( cols[i].fmt ? cols[i].fmt(row, num) : fmt.int(num) ) + '|';
				}
				return line;
			}).join('\n');
		}
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
			"\n* `!!stats active-rooms` : list of the rooms having the most messages in the two last days"+
			"\n* `!!stats active-users 20` : list of the 20 users having posted the most messages in the two last days"+
			"\n* `!!stats prefs` : stats of user preferences"+
			"\n* `!!stats prefs theme` : stats of user preferences regarding themes"+
			"\n* `!!stats` : basic stats"+
			"\n* `!!stats server-graph` : monthly histogram"+
			"\n* `!!stats sockets` : stats about current connections"

	});
}
