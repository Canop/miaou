let db;

exports.configure = function(miaou){
	db = miaou.db;
	return this;
}

exports.appGetJsonPings = function(req, res){
	if (!req.user) {
		res.json({error: "no connected user"});
		return;
	}
	db.do(async function(con){
		let pings = await con.fetchUserPings(req.user.id);
		res.json({pings});
	}, function(err){
		console.log("error in appGetJsonPings:", err);
		res.json({error: err.toString()});
	});
}
