exports.appGetHelp = function(req, res){
	res.setHeader("Cache-Control", "public, max-age=7200"); // 2 hours
	res.render('help.jade');
}
