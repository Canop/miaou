const langs = exports.all = {
	en: { pgname:'english' },
	fr: { pgname:'french' },
	it: { pgname:'italian' }
};

exports.legal = {}; // codes of the languages proposed in room creation / filtering

// from an ISO lang (e.g. "fr") returns a postgresql lang name (e.g. "french")
exports.pgLang = function(name){
	var lang = langs[name];
	return lang ? lang.pgname : "english";
}

exports.configure = function(miaou){
	var conf = miaou.config;
	for (let key in langs) {
		var lang = langs[key];
		lang.name = lang.pgname[0].toUpperCase() + lang.pgname.slice(1);
		if (!conf.langs || ~conf.langs.indexOf(key)) exports.legal[key] = lang;
	}
	return this;
}
