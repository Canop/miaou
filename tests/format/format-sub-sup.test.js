require("./format.js");

doTests("Formatting - subscript & superscript", {
	"sub-sup": t(
		"245 m^3^ of H~2~0",
		"245 m<sup>3</sup> of H<sub>2</sub>0"
	),
	"sup with special chars": t(
		"e^iΠ/2^ and Ω^3^",
		"e<sup>iΠ/2</sup> and Ω<sup>3</sup>"
	),
});
