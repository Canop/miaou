
exports.name = "miaou-badges";

var	miaouRoomId;

// returns the age of the first message of that player
async function playerAge(con, player){
	var firstCreated = await con.queryValue(
		`select min(created) from message where author=$1`,
		[player.id],
		"badge check / first created"
	);
	return Math.floor(Date.now()/1000 - firstCreated);
}

async function nbRealMessages(con, player){
	var n = await con.queryValue(
		`select count(*) from message where author=$1 and length(content)>3`,
		[player.id],
		"badge check / count real messages"
	);
	return n;
}

const checks = [
	{
		name: "Less Faceless",
		level: "bronze",
		condition: "Have a profile picture",
		checkPlayer: function(con, player){
			return !!(player.avatarsrc && player.avatarkey);
		}
	},
	{
		name: "Public Writer",
		level: "bronze",
		condition: "Write at least 100 messages in 3 public rooms",
		checkPlayer: async function(con, player){
			var n = await con.queryValue(
				`select count(rr.room) from
				 	(select
					 	room,
					 	(select private from room r where r.id=room) p,
						count(m.id) c
					from message m where author=$1 group by room
					) rr
				where rr.c>=100 and rr.p=false`,
				[player.id],
				"badge check / Public Writer"
			);
			return n>=3;
		}
	},
	{
		name: "Prolific Public Writer",
		level: "silver",
		condition: "Write at least 5000 messages in 5 public rooms",
		checkPlayer: async function(con, player){
			var n = await con.queryValue(
				`select count(rr.room) from
				 	(select
					 	room,
					 	(select private from room r where r.id=room) p,
						count(m.id) c
					from message m where author=$1 group by room
					) rr
				where rr.c>=5000 and rr.p=false`,
				[player.id],
				"badge check / Public Writer"
			);
			return n>=5;
		}
	},
	{
		name: "Stellar",
		level: "bronze",
		condition: "Receive stars from 3 different users",
		checkPlayer: async function(con, player){
			var row = await con.queryRow(
				`select count(distinct player) n from message_vote
				 join message on message=id where vote='star' and author=$1`,
				[player.id],
				"badge check / Stellar"
			);
			return row.n>=3;
		}
	},
	{
		name: "Old User",
		level: "bronze",
		condition: "Be a user for one year and write 5k real messages",
		checkPlayer: async function(con, player){
			var age = await playerAge(con, player);
			if (age < 365*24*60*60) return false;
			var n = await nbRealMessages(con, player);
			if (n < 5000) return false;
			return true;
		}
	},
	{
		name: "Veteran",
		level: "silver",
		condition: "Be a user for three years and write 15k real messages",
		checkPlayer: async function(con, player){
			var age = await playerAge(con, player);
			if (age < 3*365*24*60*60) return false;
			var n = await nbRealMessages(con, player);
			if (n < 15000) return false;
			return true;
		}
	},
	{
		name: "Ancestor",
		level: "gold",
		condition: "Be a user for five years and write 30k real messages",
		checkPlayer: async function(con, player){
			var age = await playerAge(con, player);
			if (age < 5*365*24*60*60) return false;
			var n = await nbRealMessages(con, player);
			if (n < 30000) return false;
			return true;
		}
	},
];

exports.init = function(miaou){
	var badging = miaou.plugin("badging");
	if (!badging) {
		console.log("Badging plugin not available for Miaou badges");
		return;
	}
	miaouRoomId = miaou.conf("pluginConfig", "miaou-badges", "room");
	if (!miaouRoomId) {
		console.log("No Official Room specified for Miaou. Plugin 'miaou-badges' is disabled.");
		return;
	}
	return miaou.requestTag({
		name: "Miaou",
		condition: "Discuss Miaou usage, features, bugs, installation, code, etc."
	})
	.then(function(){
		return miaou.db.on()
		.then(function(){
			return registerBadges(this, badging);
		})
		.finally(miaou.db.off);
	});
}

async function registerBadges(con, badging){
	for (var i=0; i<checks.length; i++) {
		var c = checks[i];
		await badging.register(con, {
			badge: {
				tag: "Miaou",
				name: c.name,
				level: c.level,
				condition: c.condition
			},
			awardRoom: miaouRoomId,
			checkPlayer: c.checkPlayer
		});
	}
}
