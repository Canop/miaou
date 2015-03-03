var fmt = require("./miaou.format.node.js"),
	buster = require("buster");
	
function t(s,r){
	return function(){
		buster.assert.equals(fmt.mdToHtml(s), r);		
	}
}

buster.testCase("Formatting - Quotes", {
	"quotation bloc with style": t(
		"> A citation over 4 lines with some **bold** and some *italic*, a blank line,\n"+
		">\n"+
		"> an URL : http://dystroy.org,\n"+
		"> and a markdown style link : [dystroy](http://dystroy.org)",
		'<span class=citation>A citation over 4 lines with some <b>bold</b> and some <i>italic</i>, a blank line,</span><br><span class=citation></span><br><span class=citation>an URL : <a target=_blank href="http://dystroy.org">http://dystroy.org</a>,</span><br><span class=citation>and a markdown style link : <a target=_blank href="http://dystroy.org">dystroy</a></span>'
	),
});



