var fmt = require("./miaou.format.node.js").mdToHtml,
	buster = require("buster");
	
function t(s,r){
	return function(){
		buster.assert.equals(fmt(s), r);		
	}
}

buster.testCase("Formatting - Bold, Italic, Strike", {
    "no change": t(
		"simple one-line text",
		"simple one-line text"
	),
    "bold (dash)": t(
		"abc **def ghi** wzzz...",
		"abc <b>def ghi</b> wzzz..."
	),
    "italic (dash)": t(
		" a sentence with *a few words italicized*",
		" a sentence with <i>a few words italicized</i>"
	),
    "bold (underscore)": t(
		"abc __def ghi__ wzzz...",
		"abc <b>def ghi</b> wzzz..."
	),
    "italic (underscore)": t(
		" a sentence with _a few words italicized_",
		" a sentence with <i>a few words italicized</i>"
	),
    "strike": t(
		"---first--- and ---third--- words as strike",
		"<strike>first</strike> and <strike>third</strike> words as strike"
	),
	"italic and bold nested": t(
		"*This sentence is in italic and the end is **in bold too***",
		'<i>This sentence is in italic and the end is <b>in bold too</b></i>'
	),
	"bold and italic nested with spacing": t(
		"**Now the reverse : all in bold and the last word in *italic* **",
		'<b>Now the reverse : all in bold and the last word in <i>italic</i> </b>'
	),
	"// bold and italic nested without spacing": t(
		"**Now the reverse : all in bold and the last word in *italic***",
		'<b>Now the reverse : all in bold and the last word in <i>italic</i></b>'
	),
    "mix strike, italic and bold": t(
		"most of ---this sentence is striken, with some _italic_ and some __bold__---",
		"most of <strike>this sentence is striken, with some <i>italic</i> and some <b>bold</b></strike>"
	),
	"orphan stars":t(
		"**start is bold** but here are some stars : ** (*not boldening*)",
		"<b>start is bold</b> but here are some stars : ** (<i>not boldening</i>)"
	),
    "mix on 3 lines": t(
		"some **bold** followed\nby\n2 *other lines*",
		"some <b>bold</b> followed<br>by<br>2 <i>other lines</i>"
	),
});
