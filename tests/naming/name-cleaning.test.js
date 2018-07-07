const lib = require('../../libs/naming.js');

function trd(input, output){
	expect(lib.removeDiacritics(input)).toBe(output);
}
function tsu(input, regex){
	expect(lib.suggestUsername(input)).toMatch(regex);
}
function tmmc(input, output){
	expect(lib.makeMarkdownCompatible(input)).toBe(output);
}

describe("naming", ()=>{
	test("remove diacritics", function(){
		trd("chaîne", "chaine");
		trd("quelques mots accentués ou à cédille en Français", "quelques mots accentues ou a cedille en Francais");
		trd("Münshen", "Munshen");
		trd(
			"Dès lors les voyelles et consonne accompagnées d’un signe diacritique"+
			" connues de la langue française sont : à - â - ä - é - è - ê - ë - ï - î - ô - ö - ù - û - ü - ÿ - ç",
			"Des lors les voyelles et consonne accompagnees d’un signe diacritique"+
			" connues de la langue francaise sont : a - a - a - e - e - e - e - i - i - o - o - u - u - u - y - c"
		);
		trd(
			"À Â Ä Ç É È Ê Ë Î Ï Ô Ö Ù Û Ü",
			"A A A C E E E E I I O O U U U"
		);
		trd("L'Haÿ-les-Roses", "L'Hay-les-Roses");
		trd("天空中我失去了我的化油器！", "天空中我失去了我的化油器！");
		trd("Я потерял карбюратора", "Я потерял карбюратора"); // we should do better
	});
	test("suggest username", function(){
		tsu("", /^[a-zA-Z][\w\-]{2,19}$/);
		tsu("!!!", /^[a-zA-Z][\w\-]{2,19}$/);
		tsu("A0", /^[a-zA-Z][\w\-]{2,19}$/);
		tsu("0_0", /^[a-zA-Z][\w\-]{2,19}$/);
		tsu("dystroy", /^dystroy$/);
		tsu("Parbleu!", /^Parbleu.$/);
		tsu("J'ai égaré mon carburateur!", /^J_ai_egare_mon_carbu$/);
		tsu("L'Haÿ-les-Roses", /^L_Hay-les-Roses$/);
		tsu("天空中我失去了我的化油器！", /^[a-zA-Z][\w\-]{12}$/);
	});
	test("make markdown compatible", function(){
		tmmc(" [test](http://bla.bla/r)", " ❲test❳⟮http://bla.bla/r⟯");
		tmmc("**gras** et _italique_", "⁕⁕gras⁕⁕ et ⎽italique⎽");
	});
});

