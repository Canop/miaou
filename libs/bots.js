// some services for bots
const	pingableBots = new Map; // Map lowercased bot name -> function(shoe,message)

exports.registerPingableBot = function(bot, onPing){
	pingableBots.set(bot.name.toLowerCase(), onPing);
}
exports.onPing = function(ping, shoe, message){
	console.log("onPing", ping);
	var fun = pingableBots.get(ping);
	if (fun) {
		fun(shoe, message);
		return true;
	}
}
