
let introText;

exports.configure = function(miaou){
	introText = miaou.conf("legal", "introduction");
}

exports.appGetLegal = function(req, res){
	res.setHeader("Cache-Control", "public, max-age=7200"); // 2 hours
	res.render('legal.pug', {introText});
}


