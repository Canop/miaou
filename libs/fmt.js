
const MMM = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	
exports.date = function(seconds, pat){
	console.log(seconds);
	var	date = new Date(seconds*1000),
		day = date.getDate(),
		month = date.getMonth();
	console.log(date, day, month);
	return pat
		.replace(/DD/g, (day<10 ? '0' : '') + day)
		.replace(/MMM/g, MMM[date.getMonth()])
		.replace(/MM/g, (month<10 ? '0' : '') + month)
		.replace(/YYYY/g, date.getFullYear())
		.replace(/YY/g, date.getYear());
}


exports.int = function(num){
	if (!+num) return num || ' ';
	return (+num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009");
}
