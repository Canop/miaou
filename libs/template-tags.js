exports.dedent = function(strings, ...args){

	function dedent(str){
		var	lines = str.replace(/^\n+/, '').split("\n"),
			indent = lines[0].match(/^\s*/)[0];
		return lines.map(l=>{
			if (!l.startsWith(indent)) return l;
			return l.slice(indent.length);
		}).join("\n");
	}

	if (typeof strings === "string") {
		return dedent(strings);
	}

	if (typeof strings === "function") {
		return (...args) => dedent(strings(...args));
	}

	return dedent(
		strings
		.slice(0, args.length + 1)
		.map((str, i) => (i === 0 ? "" : args[i - 1]) + str)
		.join("")
	);
}
