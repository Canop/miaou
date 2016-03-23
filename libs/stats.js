// !!stats command

const	siostats = require('./stats-sockets.js');

var	miaou;

exports.configure = function(_miaou){
	miaou = _miaou;
	return this;
}

function doStats(ct){
	// this regex must be changed with care : it prevents injections
	var	match = ct.args.match(/([@\w\-]+)(\s+[a-zA-Z]+)?(\s+\d+)?/),
		room = ct.shoe.room,
		topic = 'server',
		subtopic,
		ranking = true,
		n = 10;
	if (match) {
		topic = match[1];
		subtopic = match[2];
		n = Math.min(+match[3] || n, 500);
	}
	if (/^socket/i.test(topic)) {
		return siostats.doStats(ct, miaou.io);
	}
	if (/^me$/i.test(topic)) topic = '@'+ct.username();
	var cols, from, title, args=[], orderingCol;

	/* eslint-disable max-len */

	if (/^server$/i.test(topic)) {
		cols = [
			{name:"Users", value:"(select count(*) from player)"},
			{name:"Public Rooms", value:"(select count(*) from room where private=false)"},
			{name:"Private Rooms", value:"(select count(*) from room where private=true)"},
			{name:"Messages", value:"(select count(*) from message)"},
			{name:"Last Two Days Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800)"},
		];
		title = "Server Statistics";
	} else if (/^server-graph$/i.test(topic)) {
		cols = [
			{name:"Month", value:"extract(year from to_timestamp(created))*100+extract(month from to_timestamp(created))"},
			{name:"Messages", value:"count(*)"},
			{name:"Authors", value:"count(distinct author)"},
		];
		from = "from message group by c0 order by c0";
		title = "Server Statistics #graph";
		ranking = false;
	} else if (/^(active-)?users$/i.test(topic)) {
		cols = [
			{name:"Name", value:"name", fmt:row => "["+row.c0+"](u/"+row.c0+")" },
			{name:"Messages", value:"(select count(*) from message where author=player.id)"},
			{name:"Last Two Days Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800 and author=player.id)"},
			{name:"Stars", value:"(select sum(star) from message where author=player.id)"},
			{name:"Rooms", value:"(select count(distinct room) from message where author=player.id)"},
		];
		orderingCol = /^active-/i.test(topic) ? 2 : 1;
		from = "from player where bot is false order by c"+orderingCol+" desc limit "+n;
		title = "Users Statistics (top "+n+")";
	} else if (/^roomusers$/i.test(topic)) {
		cols = [
			{name:"Name", value:"name"},
			{name:"Room Messages", value:"(select count(*) from message where author=player.id and room=$1)"},
			{name:"Last Two Days Room Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800 and author=player.id and room=$1)"},
			{name:"Stars", value:"(select count(*) from message_vote, message where author=player.id and message_vote.message=message.id and vote='star' and room=$1)"},
			{name:"Total Messages", value:"(select count(*) from message where author=player.id)"},
		];
		from = "from player where bot is false and exists(select id from message where author=player.id and room=$1) order by c1 desc limit "+n;
		args.push(room.id);
		title = "Room Users Statistics (top "+n+")";
	} else if (topic[0]==='@') {
		cols = [
			{name:"Messages", value:"(select count(*) from message where author=player.id)"},
			{name:"Last Two Days Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800 and author=player.id)"},
			{name:"Received Stars", value:"(select count(*) from message_vote, message where author=player.id and message_vote.message=message.id and vote='star')"},
			{name:"Given Stars", value:"(select count(*) from message_vote where player=player.id and vote='star')"},
			{name:"Messages In This Room", value:"(select count(*) from message where room=$2 and author=player.id)"},
			{name:"Rooms", value:"(select count(distinct room) from message where author=player.id)"},
		];
		from = "from player where name=$1";
		args.push(topic.slice(1), room.id);
		title = "Statistics for user "+topic;
	} else if (/^(active-)?rooms$/i.test(topic)) {
		cols = [
			{name:"Id", value:"id"},
			{name:"Name", value:"name", fmt:row => "["+row.c1+"]("+row.c0+"#)" },
			{name:"Language", value:"lang"},
			{name:"Private", value:"private"},
			{name:"Messages", value:"(select count(*) from message where room=room.id)"},
			{name:"Last Two Days Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800 and room=room.id)"},
			{name:"Users", value:"(select count(distinct author) from message where room=room.id)"},
		];
		orderingCol = /^active-/i.test(topic) ? 5 : 4;
		from = "from room order by c"+orderingCol+" desc limit "+n;
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
		if (subtopic) from += " where name='"+subtopic.trim()+"'";
		else ranking=false;
		from += " group by name, value order by name, c2 desc limit "+n;
		title = "Preferences Statistics";
	} else {
		throw "Wrong statistics request. Use `!!stats [server|me|@user|users|room|rooms] [n]`.";
	}
	var sql = "select " + cols.map((col, i) => (col.value||col.name)+' c'+i).join(',');
	if (from) sql += ' '+from;

	/* eslint-enable max-len */

	return this.queryRows(sql, args, true).then(function(rows){
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
					line += ( cols[i].fmt ? cols[i].fmt(row) : row['c'+i] ) + '|';
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
