require("./format.js");

doTests("Formatting - Titles", {
	"h1": t(
		"Ligne suivante:\n# H1",
		'Ligne suivante:<br><span class=h1>H1</span>'
	),
	"h2": t(
		"## titre moyen",
		'<span class=h2>titre moyen</span>'
	),
	"h3": t(
		"### petit titre",
		'<span class=h3>petit titre</span>'
	),
	"h4": t(
		"#### tout petit titre",
		'<span class=h4>tout petit titre</span>'
	),
	"h5": t(
		"##### μtitle",
		'<span class=h5>μtitle</span>'
	),
	"italic in title": t(
		"# titled title\n# *tilted title*",
		'<span class=h1>titled title</span><br><span class=h1><i>tilted title</i></span>'
	),
});



