// some services for bots
const	bots = new Map; // Map lowercased bot name -> options

// can be called several times.
// Known options:
// 	- onPing : function
exports.register = function(bot, options){
	let	lname = bot.name.toLowerCase(),
		bo = bots.get(lname);
	console.log('register bot', lname);
	if (!bo) {
		bots.set(lname, bo = Object.create(null));
	}
	if (!options) return;
	for (let k in options) {
		bo[k] = options[k];
	}
}

// returns true when the bot has been found
exports.onPing = async function(lname, shoe, message){
	let	bo = bots.get(lname);
	if (!bo) return false;
	if (bo.onPing) {
		await bo.onPing(shoe, message);
	}
	return true;
}
