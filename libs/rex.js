// regular expression utilities

exports.concat = function(){
	let	flags = "",
		regexes = Array.from(arguments);
	if (typeof regexes[regexes.length-1] === "string") {
		flags = regexes.pop();
	}
	return new RegExp(regexes.map(r=>r.source).join(""), flags);
}
