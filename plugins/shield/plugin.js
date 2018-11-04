var	server,
	dedent,
	availableFlags = ["en", "fr", "it"];

exports.init = function(miaou){
	server = miaou.lib("server");
	dedent = miaou.lib("template-tags").dedent;
}

function onCommand(ct){
	var	room = ct.shoe.room,
		langPostfix = ~availableFlags.indexOf(room.lang) ? "-"+room.lang : "",
		shieldUrl = server.url("/static/shields/room"+langPostfix+".svg?v=1"),
		roomUrl = server.roomUrl(room),
		alt = "Chat on Miaou";
	ct.reply(dedent`
		If the current room is the best place to provide support, add a link to your site or repository.
		# Preview:
		${shieldUrl}
		# Markdown:
		Add the following markdown to your repository's \`README.md\`:
		    [![${alt}](${shieldUrl})](${roomUrl})
		# HTML:
		    <a href=${roomUrl} title="${alt}"><img alt="${alt}" src=${shieldUrl}></a>`
	);
	ct.end();
}

exports.registerCommands = function(cb){
	cb({
		name: "shield",
		fun: onCommand,
		canBePrivate: true,
		help: "generate a shield-type link to this room for your site or repository",
	});
}
