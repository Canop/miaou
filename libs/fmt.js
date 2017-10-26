const naming = require('./naming.js');

const MMM = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// returns the integer formatted with two digits (e.g. "03")
function td(num){
	return (num<10 ? "0": "") + num;
}

exports.date = function(seconds, pat){
	var	date = new Date(seconds*1000),
		month = date.getMonth();
	return pat
		.replace(/DD/g, td(date.getDate()))
		.replace(/MMM/g, MMM[date.getMonth()])
		.replace(/MM/g, td(month+1))
		.replace(/YYYY/g, date.getFullYear())
		.replace(/YY/g, date.getYear())
		.replace(/hh/g, td(date.getHours()))
		.replace(/mm/g, td(date.getMinutes()));
}

// formats a duration in milliseconds (ex: " 08h 37m 27s")
exports.duration = function(t){
	var d = t/86400000|0;
	return (d ? d+"d ":"")+(new Date(t-d|0)).toUTCString().replace(/.*(\d{2}):(\d{2}):(\d{2}).*/, "$1h $2m $3s");
}

exports.int = function(num){
	if (!+num) return num || ' ';
	return (+num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009");
}

const alignMd = { l: ":-", c: ":-:", r: "-:" };
// returns a markdown table
// o:
//  cols: col names
//  rows: string arrays
//  rank: if true, a ranking column is added
//  aligns: optional array of alignments (default is centering)
exports.tbl = function(o){
	var	c = "",
		aligns = o.aligns,
		rank = o.rank && o.rows.length>1;
	if (rank) c += "#|";
	c += o.cols.join("|") + "\n";
	if (rank) c += "-:|";
	if (aligns) {
		if (typeof aligns === "string") aligns = Array.from(aligns);
		c += o.cols.map((_, i) => alignMd[aligns[i]] || ":-:").join("|");
	} else {
		c += ":-:|".repeat(o.cols.length);
	}
	c += "\n" + o.rows.map(function(row, l){
		var line="";
		if (rank) line += l+1+"|";
		line += row.join("|");
		return line;
	}).join("\n");
	return c;
}

exports.playerLink = function(name){
	var mdname = naming.makeMarkdownCompatible(name);
	if (!naming.isValidUsername(name)) return mdname;
	return "["+mdname+"](u/"+name+")";
}

exports.roomLink = function(room){
	return "["+naming.makeMarkdownCompatible(room.name)+"]("+room.id+"#)";
}

// make a list in the Oxford comma style (eg "a, b, c, and d")
exports.oxford = function(arr, ifempty){
	var l = arr.length;
	if (!l) return ifempty;
	if (l<2) return arr[0];
	arr = arr.slice();
	arr[l-1] = "and " + arr[l-1];
	return arr.join(", ");
}
