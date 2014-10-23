// Manages user preferences.
//
// Today prefs :
//  - notif : user notification level
//  - snd : sound (none, sound one, sound two, etc.)
//  - date : permanent message date display

var	db,
	validKeys = {};

exports.configure = function(miaou){
	db = miaou.db;
	['notif'].forEach(function(k){
		validKeys[k] = true;
	});
	return this;
}

exports.set = function(userId, obj){
	
}

exports.get = function(userId, name){
	
}

