require("./format.js");

doTests("Formatting - Bold, Italic, Strike", {
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
	"underline (underscore)": t(
		" a sentence with __a few words underline__",
		" a sentence with <u>a few words underline</u>"
	),
	"strike": t(
		"---first--- and ---third--- words as strike",
		"<strike>first</strike> and <strike>third</strike> words as strike"
	),
	"two italicized words separated by just one space": t(
		// bug observed here : http://miaou.dystroy.org/73?Tribo_Room#538224
		"*sob* *sob*",
		"<i>sob</i> <i>sob</i>"
	),
	"italic, underline and bold": t(
		"__***italic, underline and bold***__",
		"<u><i><b>italic, underline and bold</b></i></u>"
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
		// it makes a bad code, I don't really have a solution right now apart
		//  using a dom tree - current solution : alternate stars and low dashes
		"**Now the reverse : all in bold and the last word in *italic***",
		'<b>Now the reverse : all in bold and the last word in <i>italic</i></b>'
	),
	"mix strike, italic and underline - 1": t(
		"most of ---this sentence is striken, with some _italic_ and some __underline__---",
		"most of <strike>this sentence is striken, with some <i>italic</i> and some <u>underline</u></strike>"
	),
	"mix strike, italic and bold - 2": t(
		"** bold sentence with ---striken *italicized words*---**",
		"<b> bold sentence with <strike>striken <i>italicized words</i></strike></b>"
	),
	"links with dash in an italicized sentence": t(
		"*[ralt](https://github.com/ralt) pushed in [ralt/deb-packager](https://github.com/ralt/deb-packager)*",
		"<i><a target=_blank href=\"https://github.com/ralt\">ralt</a> pushed in <a target=_blank href=\"https://github.com/ralt/deb-packager\">ralt/deb-packager</a></i>"
	),
	"links with dash in a bold sentence": t(
		"**[ralt](https://github.com/ralt) pushed in [ralt/deb-packager](https://github.com/ralt/deb-packager)**",
		"<b><a target=_blank href=\"https://github.com/ralt\">ralt</a> pushed in <a target=_blank href=\"https://github.com/ralt/deb-packager\">ralt/deb-packager</a></b>"
	),
	"orphan stars": t(
		"**start is bold** but here are some stars : ** (*not boldening*)",
		"<b>start is bold</b> but here are some stars : ** (<i>not boldening</i>)"
	),
	"mix on 3 lines": t(
		"some **bold** followed\nby\n2 *other lines*",
		"some <b>bold</b> followed<br>by<br>2 <i>other lines</i>"
	),
	"false style - style starting in link text": t(
		'[** false bold link text](http://dystroy.org)**',
		'<a target=_blank href="http://dystroy.org">** false bold link text</a>**'
	),
	"false style - one star then two": t(
		'*one star then two**',
		'*one star then two**'
	),
	"checked, unchecked box": t(
		'[ ] simple box *now checked and in italic [x]* or not: [x]',
		'☐ simple box <i>now checked and in italic ☑</i> or not: ☑'
	),
	"xml entities": t(
		'*a &acute;*',
		'<i>a &amp;acute;</i>'
	),
});
