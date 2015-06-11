
var bot;

exports.name = "Dices";

exports.init = function(miaou){
	bot = miaou.bot;
}

function rollDices(ct){
	var m = ct.args.match(/^\s*(\d+)?\s*d\s*(\d+)\s*([+-]\s*\d+)?/i);
	if (!m) throw "invalid syntax";
	var	nbDices = +m[1]||1,
		nbSides = +m[2],
		constant = m[3] ? +m[3].replace(/\s+/g,'') : 0;
	if (nbDices<1) throw "you can't roll less than one dice";
	if (nbSides<2) throw "there's no such dice";
	var	sum = constant,
		exp = constant,
		dices = [];
	for (var i=0; i<nbDices; i++) {
		var v = Math.ceil(Math.random()*nbSides);
		dices.push(v);
		sum += v;
		exp += (nbSides+1)/2;
	}
	var	cols = ['Sum'],
		row = [sum];
	if (nbDices>1 && nbDices<=12) {
		cols = dices.map(function(_,i){ return i+1 }).concat(cols);
		row = dices.concat(row);
	}
	ct.reply(
		'Rolling '+nbDices+' '+nbSides+'-sided dice'+(nbDices>1?'s':'')+
		(constant ? ' and adding '+constant : '')+
		' (expect: '+exp.toFixed(1)+')'+
		'\n|'+cols.join('|')+'|\n'+
		'|'+cols.map(function(){ return ':-:' }).join('|')+'|\n'+
		'|'+row.join('|')+'|\n'
	);
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name:'dice',
		fun:rollDices,
		help:"roll some dices. Exemple: `!!dice 3D24`",
		detailedHelp:"Examples:"
			+ "\n* `!!dice D6`"
			+ "\n* `!!dice 2D6+5`"
			+ "\n* `!!dice 7d24`"
	});
}
