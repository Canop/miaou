var cache = require('bounded-cache')(100); // not necessarily the last version, we don't care

var r = /^(@[\w-]{3,}#?\d*\s+)?!!whiteboard(\s|$)/;

function chown(newMessage, savedMessage){
	if (
		savedMessage.author!==newMessage.author
		&& r.test(savedMessage.content)!==r.test(newMessage.content)
	) {
		throw "Only its author can change a message to or from a white board";
	}
	newMessage.author = savedMessage.author;
}

// note : core calls this with context being a db connection
function onCommand(ct){
	var m = ct.message;
	if (m.id) {
		ct.ignoreMaxAgeForEdition = true; // note : this probably allows anybody to edit his very old message
		// not a new message, let's check it was already a whiteboard message
		//  and in that case we just set the author so that it can be saved
		var savedMessage = cache.get(m.id);
		if (savedMessage) {
			chown(m, savedMessage);
		} else {
			return this.getMessage(m.id).then(function(savedMessage){
				cache.set(m.id, savedMessage)
				chown(m, savedMessage);
			})
		}
	} else {
		// nothing to do for a new message, let's just cache it to make it easier
		//  to find later
		cache.set(m.id, m);
	}
}

exports.registerCommands = function(cb){
	cb({
		name:'whiteboard', fun:onCommand,
		help:"Starting a message with `!!whiteboard` lets everybody edit it"
	});
}
