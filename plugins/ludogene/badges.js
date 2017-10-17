
const	elo = require("./elo.js");

var	ladderCache,
	triboRoomId;

async function getLadder(con){
	var now = Date.now()/1000|0;
	if (!ladderCache || (ladderCache.time < now - 12*60*60)) {
		ladderCache = {
			time: now,
			ladder: await elo.getLadder(con)
		};
	}
	return ladderCache.ladder;
}

const checks = [
	{
		name: "Ranked",
		level: "bronze",
		condition: "Enter the Tribo ladder with a rating greater than 1200",
		checkPlayer: async function(con, player){
			var ladder = await getLadder(con);
			var rating = ladder.ratingsMap.get(player.id);
			return rating && rating.r>1200;
		}
	},
	{
		name: "Serious Player",
		level: "bronze",
		condition: "Finish 200 games against 10 opponents and have a rating greater than 1900",
		checkPlayer: async function(con, player){
			var ladder = await getLadder(con);
			var rating = ladder.ratingsMap.get(player.id);
			return rating && rating.f>=200 && rating.nbOpponents()>=10 && rating.r>1900;
		}
	},
	{
		name: "Open Player",
		level: "bronze",
		condition: "Finish games against 25 opponents and have a rating greater than 1800",
		checkPlayer: async function(con, player){
			var ladder = await getLadder(con);
			var rating = ladder.ratingsMap.get(player.id);
			return rating && rating.nbOpponents()>=25 && rating.r>1800;
		}
	},
	{
		name: "Universal Player",
		level: "silver",
		condition: "Finish games against 100 opponents and have a rating greater than 1900",
		checkPlayer: async function(con, player){
			var ladder = await getLadder(con);
			var rating = ladder.ratingsMap.get(player.id);
			return rating && rating.nbOpponents()>=100 && rating.r>1900;
		}
	},
	{
		name: "Champion",
		level: "silver",
		condition: "Finish 222 games against 22 opponents and have a rating greater than 2222",
		checkPlayer: async function(con, player){
			var ladder = await getLadder(con);
			var rating = ladder.ratingsMap.get(player.id);
			return rating && rating.f>=222 && rating.nbOpponents()>=22 && rating.r>2222;
		}
	},
	{
		name: "Universal Champion",
		level: "gold",
		condition: "Finish games against 100 opponents and have a rating greater than 2300",
		checkPlayer: async function(con, player){
			var ladder = await getLadder(con);
			var rating = ladder.ratingsMap.get(player.id);
			return rating && rating.nbOpponents()>=100 && rating.r>2300;
		}
	},
]

exports.init = function(miaou){
	var badging = miaou.plugin("badging");
	if (!badging) {
		console.log("Badging plugin not available for Tribo badges");
		return;
	}
	triboRoomId = miaou.conf("pluginConfig", "ludogene", "Tribo", "room");
	if (!triboRoomId) {
		console.log("No Official Room specified for Tribo. Tribo badges are disabled.");
		return;
	}
	return miaou.db.on()
	.then(function(){
		return registerBadges(this, badging);
	})
	.finally(miaou.db.off);
}

async function registerBadges(con, badging){
	for (var i=0; i<checks.length; i++) {
		var c = checks[i];
		await badging.register(con, {
			badge: {
				tag: "Tribo",
				name: c.name,
				level: c.level,
				condition: c.condition
			},
			awardRoom: triboRoomId,
			checkPlayer: c.checkPlayer
		});
	}
}

