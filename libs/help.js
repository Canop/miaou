exports.appGetHelp = function(req, res){
	res.setHeader("Cache-Control", "public, max-age=7200"); // 2 hours
	res.render('help.pug');
}

exports.appGetHelpUs = function(req, res){
	res.setHeader("Cache-Control", "public, max-age=3600"); // 1 hour
	res.render('helpus.pug');
}
