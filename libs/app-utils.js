const	naming = require('./naming.js'),
	mobileRegex = /Android|webOS|iPhone|iPad|Mini/i;

var config;

exports.configure = function(miaou){
	config = miaou.config;
	return this;
}

exports.url = function(pathname){ // todo cleaner way in express not supposing absolute paths ?
	return config.server+(pathname||'/');
}

exports.roomPath = function(room){
	return room.id+'?'+naming.toUrlDecoration(room.name);
}
exports.roomUrl = function(room){
	return exports.url('/'+exports.roomPath(room));
}

exports.mobile = function(req){
	return mobileRegex.test(req.headers['user-agent']);
}

