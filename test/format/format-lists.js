var fmt = require("./miaou.format.node.js").mdToHtml,
	buster = require("buster");
	
function t(s,r){
	return function(){
		buster.assert.equals(fmt(s), r);		
	}
}

buster.testCase("Formatting - Lists", {
	"OL": t(
		"# Rules :\n"+
		"1. you can test it\n"+
		"1. nothing is saved\n"+
		"1. the existing text is *just an example*",
		'<span class=h1>Rules :</span><br><span class=olli>1</span>you can test it<br><span class=olli>2</span>nothing is saved<br><span class=olli>3</span>the existing text is <i>just an example</i>'
	),
	"UL": t(
		"* a list item\n"+
		"* followed by ---**many** _other ones_--- __another__ _one_",
		"<span class=ulli></span>a list item<br><span class=ulli></span>followed by <strike><b>many</b> <i>other ones</i></strike> <b>another</b> <i>one</i>"
	),
});
