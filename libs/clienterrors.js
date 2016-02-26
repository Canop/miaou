exports.configure = function(miaou){
	return this;
}

exports.appPostError = function(req, res){
	console.log("================================\nERROR IN BROWSER");
	['user', 'page', 'message', 'url', 'line', 'col', 'err'].forEach(function(n){
		console.log(n+":", req.body[n]);
	});
	console.log("================================\n");
	res.send("OK");
}
