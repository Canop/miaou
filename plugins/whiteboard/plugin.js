const r = /^(@[\w-]{3,}#?\d*\s+)?!!whiteboard(\s|$)/;

// note : core calls this with context being a db connection
async function onCommand(ct){
	let m = ct.message;
	if (!m.id) return; // nothing to check
	let savedMessage = await this.getMessage(m.id);
	if (
		savedMessage.author !== m.author
		&& r.test(savedMessage.content) !== r.test(m.content)
	) {
		throw "Only its author can change a message to or from a white board";
	}
	// normally there's an error when a message is edited by an user who's not
	// the initial author. In order to bypass the check, we just change the visible
	// message author to the original one (this won't change the author in DB)
	m.author = savedMessage.author;
}

exports.registerCommands = function(cb){
	cb({
		name: 'whiteboard',
		fun: onCommand,
		help: "Starting a message with `!!whiteboard` lets everybody edit it"
	});
}
