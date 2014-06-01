exports.appGetIntro = function(req, res){
	res.setHeader("Cache-Control", "public, max-age=7200"); // 2 hours
	res.render('intro.jade');
}
