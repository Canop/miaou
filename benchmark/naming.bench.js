// benchmarking for the removal of diacritics

var rd = require('../libs/naming.js').removeDiacritics;

var stringsToClean = [
	"Colin terminait sa toilette. Il s’était enveloppé, au sortir du bain, d’une ample serviette de tissu bouclé dont seuls ses jambes et son torse dépassaient. Il prit à l’étagère, de verre, le vaporisateur et pulvérisa l’huile fluide et odorante sur ses cheveux clairs. Son peigne d’ambre divisa la masse soyeuse en longs filets orange pareils aux sillons que le gai laboureur trace à l’aide d’une fourchette dans de la confiture d’abricots. Colin reposa le peigne et, s’armant du coupe-ongles, tailla en biseau les coins de ses paupières mates, pour donner du mystère à son regard. Il devait recommencer souvent, car elles repoussaient vite. Il alluma la petite lampe du miroir grossissant et s’en approcha pour vérifier l’état de son épiderme. Quelques comédons saillaient aux alentours des ailes du nez. En se voyant si laids dans le miroir grossissant, ils rentrèrent prestement sous la peau et, satisfait, Colin éteignit la lampe. Il détacha la serviette qui lui ceignait les reins et passa l’un des coins entre ses doigts de pied pour absorber les dernières traces d’humidité. Dans la glace, on pouvait voir à qui il ressemblait, le blond qui joue le rôle de Slim dans Hollywood Canteen. Sa tête était ronde, ses oreilles petites, son nez droit, son teint doré. Il souriait souvent d’un sourire de bébé, et, à force, cela lui avait fait venir une fossette au menton. Il était assez grand, mince avec de longues jambes, et très gentil. Le nom de Colin lui convenait à peu près. Il parlait doucement aux filles et joyeusement aux garçons. Il était presque toujours de bonne humeur, le reste du temps il dormait.",
	"Il vida son bain en perçant un trou dans le fond de la baignoire. Le sol de la salle de bains, dallé de grès cérame jaune clair, était en pente et orientait l’eau vers un orifice situé juste au-dessus du bureau du locataire de l’étage inférieur. Depuis peu, sans prévenir Colin, celui-ci avait changé son bureau de place. Maintenant, l’eau tombait sur son garde-manger.",
	"Il glissa ses pieds dans des sandales de cuir de roussette et revêtit un élégant costume d’intérieur, pantalon de velours à côtes vert d’eau très profonde et veston de calmande noisette. Il accrocha la serviette au séchoir, posa le tapis de bain sur le bord de la baignoire et le saupoudra de gros sel afin qu’il dégorgeât toute l’eau contenue. Le tapis se mit à baver en faisant des grappes de petites bulles savonneuses.",
	"Il sortit de la salle de bain et se dirigea vers la cuisine, afin de surveiller les derniers préparatifs du repas",
	"Dès lors les voyelles et consonne accompagnées d’un signe diacritique connues de la langue française sont : à - â - ä - é - è - ê - ë - ï - î - ô - ö - ù - û - ü - ÿ - ç",
	"Dès l'ouverture de ce roman, le lecteur est directement confronté au jeu des inversions : dans un univers absurde, qui imite l'univers du rêve et des plus étranges, le narrateur présente un personnage particulièrement banal et indéfini.",
	"Sacrebleu!",
	"天空中我失去了我的化油器！",
	"quelques mots accentués ou à cédille en Français",
	"dystroy",
	"Canopée"
];


function doRemovals(){
	var strings = stringsToClean;
	for (var i=0; i<strings.length; i++) {
		rd(strings[i]);
	}
}

function time(f, N){
	console.log("Starting " + f.name);
	var start = Date.now(), end;
	for (var i=N;i-->0;) f();
	end = Date.now();
	console.log(' -> ' + ((end-start)/N).toFixed(2) + ' ms');
}

time(doRemovals, 8000);
