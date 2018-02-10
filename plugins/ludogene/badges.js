
const	elo = require("./elo.js");

const	ladderCaches = {},
	rooms = {},
	gameTypes = ["Tribo", "Flore"];

async function getLadder(con, gameType){
	var now = Date.now()/1000|0;
	if (!ladderCaches[gameType] || (ladderCaches[gameType].time < now - 12*60*60)) {
		ladderCaches[gameType] = {
			time: now,
			ladder: await elo.getLadder(con, gameType)
		};
	}
	return ladderCaches[gameType].ladder;
}

const checks = [
	{
		name: "Ranked",
		level: "bronze",
		gameTypes,
		condition: "Enter the ladder with a rating greater than 1200",
		checkPlayer: async function(con, player, gameType){
			var ladder = await getLadder(con, gameType);
			var rating = ladder.ratingsMap.get(player.id);
			return rating && rating.r>1200;
		}
	},
	{
		name: "Serious Player",
		level: "bronze",
		gameTypes,
		condition: "Finish 200 games against 10 opponents and have a rating greater than 1900",
		checkPlayer: async function(con, player, gameType){
			var ladder = await getLadder(con, gameType);
			var rating = ladder.ratingsMap.get(player.id);
			return rating && rating.f>=200 && rating.nbOpponents()>=10 && rating.r>1900;
		}
	},
	{
		name: "Open Player",
		level: "bronze",
		gameTypes,
		condition: "Finish games against 25 opponents and have a rating greater than 1800",
		checkPlayer: async function(con, player, gameType){
			var ladder = await getLadder(con, gameType);
			var rating = ladder.ratingsMap.get(player.id);
			return rating && rating.nbOpponents()>=25 && rating.r>1800;
		}
	},
	{
		name: "Universal Player",
		level: "silver",
		gameTypes,
		condition: "Finish games against 100 opponents and have a rating greater than 1900",
		checkPlayer: async function(con, player, gameType){
			var ladder = await getLadder(con, gameType);
			var rating = ladder.ratingsMap.get(player.id);
			return rating && rating.nbOpponents()>=100 && rating.r>1900;
		}
	},
	{
		name: "Champion",
		level: "silver",
		gameTypes: ["Tribo", "Flore"],
		condition: "Finish 222 games against 22 opponents and have a rating greater than 2222",
		checkPlayer: async function(con, player, gameType){
			var ladder = await getLadder(con, gameType);
			var rating = ladder.ratingsMap.get(player.id);
			return rating && rating.f>=222 && rating.nbOpponents()>=22 && rating.r>2222;
		}
	},
	{
		name: "Universal Champion",
		level: "gold",
		gameTypes: ["Tribo", "Flore"],
		condition: "Finish games against 100 opponents and have a rating greater than 2300",
		checkPlayer: async function(con, player, gameType){
			var ladder = await getLadder(con, gameType);
			var rating = ladder.ratingsMap.get(player.id);
			return rating && rating.nbOpponents()>=100 && rating.r>2300;
		}
	},
]

exports.init = function(miaou){
	var badging = miaou.plugin("badging");
	if (!badging) {
		console.log("Badging plugin not available for Ludogene badges");
		return;
	}
	gameTypes.forEach(gt=>{
		rooms[gt] = miaou.conf("pluginConfig", "ludogene", gt, "room");
		if (!rooms[gt]) {
			console.log("No Official Room specified for " + gt +". Game badges are disabled.");
		}
		return;
	});
	return miaou.db.on()
	.then(function(){
		return registerBadges(this, badging);
	})
	.finally(miaou.db.off);
}

async function registerBadges(con, badging){
	for (var i=0; i<checks.length; i++) {
		var c = checks[i];
		for (let tag of c.gameTypes) {
			let r = (function(c, tag){
				return {
					badge: {
						tag,
						name: c.name,
						level: c.level,
						condition: c.condition
					},
					awardRoom: rooms[tag],
					checkPlayer: async function(con, player){
						return await c.checkPlayer(con, player, tag);
					}
				};
			})(c, tag);
			await badging.register(con, r);
		}
	}
}

