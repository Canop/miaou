const	server = require('../../libs/server.js'),
	availableFlags = ["en", "fr", "it"];

function onCommand(ct){
	var	room = ct.shoe.room,
		langPostfix = ~availableFlags.indexOf(room.lang) ? "-"+room.lang : "",
		shieldUrl = server.url("/static/shields/room"+langPostfix+".svg?v=1"),
		roomUrl = server.roomUrl(room),
		alt = "Chat on Miaou",
		md = "[!["+alt+"]("+shieldUrl+")]("+roomUrl+")",
		html = '<a href='+roomUrl+' alt="'+alt+'" title="'+alt+'"><img src='+shieldUrl+'></a>';
	var lines = [
		"If the current room is the best place to provide support,"
		+ " add a link to your site or repository.",
		"# Preview:",
		shieldUrl,
		"# Markdown:",
		"Add the following markdown to your repository's `README.md`:",
		"\t" + md,
		"# HTML:",
		"\t" + html
	];
	ct.reply(lines.join("\n"));
}

exports.registerCommands = function(cb){
	cb({
		name: "shield",
		fun: onCommand,
		help: "generate a shield-type link to this room for your site or repository",
	});
}
