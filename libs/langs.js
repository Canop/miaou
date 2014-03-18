
var langs = exports.all = {
	en: { pgname:'english'},
	fr: { pgname:'french'},
	it: { pgname:'italian'}
};
exports.legal; // codes of the languages proposed in room creation / filtering

exports.configure = function(conf){
	exports.legal = [];
	for (var key in langs) {
		if (!conf.langs || ~conf.langs.indexOf(key)) exports.legal.push(key);
	}
	console.log('Legal langs:', exports.legal);
	return this;
}
