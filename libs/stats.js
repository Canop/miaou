// !!stats command

var	bot;

exports.configure = function(miaou){
	bot = miaou.bot;
	return this;
}

function doStats(ct) {
	var	match = ct.args.match(/([@\w\-]+)(\s+\d+)?/),
		room = ct.shoe.room,
		topic = 'server',
		n = 10;
	if (match) {
		topic = match[1];
		n = Math.min(+match[2] || n, 500);
	}
	if (/^me$/i.test(topic)) topic = '@'+ct.username();
	var cols, from, title, args=[], c;
	if (/^server$/i.test(topic)) {
		cols = [
			{name:"Users", value:"(select count(*) from player)"},
			{name:"Public Rooms", value:"(select count(*) from room where private=false)"},
			{name:"Private Rooms", value:"(select count(*) from room where private=true)"},
			{name:"Messages", value:"(select count(*) from message)"},
			{name:"Two Last Days Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800)"},
		];
		title = "Server Statistics";
	} else if (/^users$/i.test(topic)) {
		cols = [
			{name:"Name", value:"name"},
			{name:"Messages", value:"(select count(*) from message where author=player.id)"},
			{name:"Two Last Days Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800 and author=player.id)"},
			{name:"Stars", value:"(select count(*) from message_vote, message where author=player.id and message_vote.message=message.id and vote='star')"},
			{name:"Rooms", value:"(select count(distinct room) from message where author=player.id)"},
		];
		from = "from player where bot is false order by c1 desc limit "+n;
		title = "Users Statistics (top "+n+")";
	} else if (/^roomusers$/i.test(topic)) {
		cols = [
			{name:"Name", value:"name"},
			{name:"Room Messages", value:"(select count(*) from message where author=player.id and room=$1)"},
			{name:"Two Last Days Room Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800 and author=player.id and room=$1)"},
			{name:"Stars", value:"(select count(*) from message_vote, message where author=player.id and message_vote.message=message.id and vote='star' and room=$1)"},
			{name:"Total Messages", value:"(select count(*) from message where author=player.id)"},
		];
		from = "from player where bot is false and exists(select id from message where author=player.id and room=$1) order by c1 desc limit "+n;
		args.push(room.id);
		title = "Room Users Statistics (top "+n+")";
	} else if (topic[0]==='@') {
		cols = [
			{name:"Messages", value:"(select count(*) from message where author=player.id)"},
			{name:"Two Last Days Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800 and author=player.id)"},
			{name:"Received Stars", value:"(select count(*) from message_vote, message where author=player.id and message_vote.message=message.id and vote='star')"},
			{name:"Given Stars", value:"(select count(*) from message_vote where player=player.id and vote='star')"},
			{name:"Messages In This Room", value:"(select count(*) from message where room=$2 and author=player.id)"},
			{name:"Rooms", value:"(select count(distinct room) from message where author=player.id)"},
		];
		from = "from player where name=$1";
		args.push(topic.slice(1), room.id);
		title = "Statistics for user "+topic;
	} else if (/^rooms$/i.test(topic)) {
		cols = [
			{name:"Id", value:"id"},
			{name:"Name", value:"name"},		
			{name:"Language", value:"lang"},		
			{name:"Private", value:"private"},		
			{name:"Messages", value:"(select count(*) from message where room=room.id)"},
			{name:"Two Last Days Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800 and room=room.id)"},
			{name:"Users", value:"(select count(distinct author) from message where room=room.id)"},
		];
		from = "from room order by c4 desc limit "+n;
		title = "Rooms Statistics (top "+n+")";
	} else if (/^room$/i.test(topic)) {
		cols = [
			{name:"Messages", value:"(select count(*) from message where room=$1)"},
			{name:"Two Last Days Messages", value:"(select count(*) from message where created>extract(epoch from now())-172800 and room=$1)"},
			{name:"Users", value:"(select count(distinct author) from message where room=$1)"},
		];
		args.push(room.id);
		title = "Statistics of the room *"+room.name+"*";		
	} else if (/^votes$/i.test(topic)) {
		cols = [
			{name:"vote", value:"vote"},
			{name:"number", value:"count(*)"},
		];
		from = "from message_vote group by vote order by c1 desc";
		title = "Voting Statistics";		
	} else {
		throw "Wrong statistics request. Use `!!stats [server|me|@user|users|room|rooms] [n]`.";
	}
	var sql = "select " + cols.map(function(col, i){ return col.value+' c'+i }).join(',');
	if (from) sql += ' '+from;
	return this.queryRows(sql, args, true).then(function(rows){
		var c;
		if (!rows.length) {
			c = "nothing found";
		} else {
			var ranking = rows.length>1;
			c = title+"\n";
			if (ranking) c += '#|';
			c += cols.map(function(c){ return c.name }).join('|')+'\n';
			if (ranking) c += '-:|';
			c += cols.map(function(){ return ':-:' }).join('|')+'\n';
			c += rows.map(function(row, l){
				var line='';
				if (ranking) line += l+1+'|';
				for (var i=0; i<cols.length; i++) line += row['c'+i]+'|';
				return line;
			}).join('\n');
		}
		ct.reply(c, ct.nostore = c.length>800);
	})
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name:'stats', fun:doStats,
		help:"Usage : `!!stats [server|me|@user|users|room|roomusers|rooms|votes] [n]`",
		detailedHelp: "Examples:"+
			"\n* `!!stats me` : give some stats about you"+
			"\n* `!!stats rooms 100` : list the 100 rooms having the most messages"
	});
}
