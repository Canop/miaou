require("./format.js");

doTests("Formatting - Quotes", {
	"quotation bloc with style": t(
		"> A citation over 4 lines with some **bold** and some *italic*, a blank line,\n"+
		">\n"+
		"> an URL : http://dystroy.org,\n"+
		"> and a markdown style link : [dystroy](http://dystroy.org)",
		'<div class=citation>A citation over 4 lines with some <b>bold</b> and some <i>italic</i>, a blank line,<br><br>an URL : <a target=_blank href="http://dystroy.org">http://dystroy.org</a>,<br>and a markdown style link : <a target=_blank href="http://dystroy.org">dystroy</a></div>'
	),
});
