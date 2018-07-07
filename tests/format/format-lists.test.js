require("./format.js");

doTests("Formatting - Lists", {
	"OL": t(
		"# Rules :\n"+
		"1. you can test it\n"+
		"1. nothing is saved\n"+
		"1. the existing text is *just an example*",
		'<span class=h1>Rules :</span><br><ol><li>you can test it</li><li>nothing is saved</li><li>the existing text is <i>just an example</i></li></ol>'
	),
	"UL": t(
		"* a list item\n"+
		"* followed by ---**many** _other ones_--- __another__ _one_",
		"<ul><li>a list item</li><li>followed by <strike><b>many</b> <i>other ones</i></strike> <u>another</u> <i>one</i></li></ul>"
	),
});
