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

// Formate un nombre. La précision après la virgule est optionnelle (valeur par défaut : 2)
// exemples :
//   formatFloat(100.0)	 => "100"
//   formatFloat(100.0, 12) => "100"
//   formatFloat(100.1)	=> "100.1"
//   formatFloat(100.1, 0) => "100"
//   formatFloat(100.7, 0) => "101"
//   formatFloat(.0434) => "0.043"
//   formatFloat(1.999999) => "2"
//   formatFloat(.0000047) => "0"
//   formatFloat(.0000047, 6)  => "0.000005"
//   formatFloat(.0000047, 12) => "0.0000047"
//   formatFloat(undefined) => ""
//   formatFloat(NaN) => ""
exports.float = function(v, p=2){
	if (!isFinite(v)) return '';
	if (p<=0) return ''+Math.round(v);
	return v.toFixed(p||2).replace(/(\.0+$)|(0+$)/, '');
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
	if (l<3) return arr.join(" and ");
	arr[l-1] = "and " + arr[l-1];
	return arr.join(", ");
}
