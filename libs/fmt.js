const naming = require('./naming.js');

// build the pseudo-markdown used to have the browser display a date according
//  to its locale and timezone
// Will bug if there's a ")" in the pattern
exports.date = function(seconds, pat){
	if (!seconds) return "?";
	let md = "#date("+seconds;
	if (pat) md += "," + pat;
	md += ")";
	return md;
}

exports.durationSince = function(t){
	return exports.duration(Date.now() - t);
}

// formats a duration in milliseconds (ex: " 08h 37m 27s")
exports.duration = function(t){
	let d = t/86400000|0;
	return (d ? d+"d ":"")+(new Date(t-d|0)).toUTCString().replace(/.*(\d{2}):(\d{2}):(\d{2}).*/, "$1h $2m $3s");
}

exports.int = function(num){
	if (!+num) return num || ' ';
	return (+num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009");
}

// format floats in a readable and concise way
// see https://gist.github.com/Canop/90b2b85bbc454650bc6636f869783c3e
exports.float = function(v, p=3){
	if (v===0) return "0";
	let absv = Math.abs(v);
	if (absv>10**(p+3) || absv<10**-p) return v.toExponential(p).replace(/0+e/, 'e');
	return v.toFixed(p).replace(/\.0+$|0+$/, '');
}

// format a number as a storage size
// exemples:
// 	bytes(7477395456) => "6.96 GB"
// 	bytes(7477395456, 1) => "7 GB"
// 	bytes(7477395456, 3) => "6.964 GB"
// 	bytes(747739) => "730.21 KB"
exports.bytes = function(v, p){
	v = +v;
	if (v<=0) return '0 Byte';
	let	k = 1024,
		sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
		i = Math.floor(Math.log(v) / Math.log(k));
	return exports.float(v / Math.pow(k, i), p) + ' ' + sizes[i];
}

const alignMd = { l: ":-", c: ":-:", r: "-:" };
// returns a markdown table
// o:
//  cols: col names (if not provided, there will be no header)
//  rows: string arrays
//  rank: if true, a ranking column is added
//  aligns: optional array of alignments (default is centering)
exports.tbl = function(o){
	let	c = "",
		aligns = o.aligns,
		cols = o.cols,
		rank = o.rank && o.rows.length>1;
	if (cols) {
		if (rank) c += "|#";
		c += cols.map(c=>"|"+c).join("") + "|\n";
		if (rank) c += "|-:";
	} else {
		// for the rest, we'll just use the longest row as if it was the cols
		cols = o.rows.reduce((longest, row) => row.length > longest.length ? row : longest, []);
	}
	if (aligns) {
		if (typeof aligns === "string") aligns = Array.from(aligns);
		c += "|" + cols.map((_, i) => alignMd[aligns[i]] || ":-:").join("|");
	} else {
		c += "|:-:".repeat(cols.length);
	}
	c += "|\n" + o.rows.map(function(row, l){
		let line="|";
		if (rank) line += l+1+"|";
		line += row.map(c=>c===""?" ":c).join("|")+"|";
		return line;
	}).join("\n");
	return c;
}

exports.playerLink = function(name){
	let mdname = naming.makeMarkdownCompatible(name);
	if (!naming.isValidUsername(name)) return mdname;
	return "["+mdname+"](u/"+name+")";
}

exports.roomLink = function(room){
	return "["+naming.makeMarkdownCompatible(room.name)+"]("+room.id+"#)";
}

// make a list in the Oxford comma style (eg "a, b, c, and d")
exports.oxford = function(arr, ifempty){
	let l = arr.length;
	if (!l) return ifempty;
	if (l<2) return arr[0];
	arr = arr.slice();
	if (l<3) return arr.join(" and ");
	arr[l-1] = "and " + arr[l-1];
	return arr.join(", ");
}
