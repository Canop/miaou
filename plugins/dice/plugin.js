exports.name = "Dices";

const DiceRollDefinition = require("./DiceRollDefinition.js");
const operators = {
	"=": (a, b)=>a==b,
	"==": (a, b)=>a==b,
	"<": (a, b)=>a<b,
	">": (a, b)=>a>b,
	"<=": (a, b)=>a<=b,
	">=": (a, b)=>a>=b,
};

let fmt;

exports.init = async function(miaou){
	fmt = miaou.lib("fmt");
}

function showDef(def, wantRoll=false, wantAllDice=false, wantDistribution=false){
	if (def.N>5000) wantRoll = false;
	if (def.N>20) wantAllDice = false;
	if (def.N<2 || def.N*def.S>5000) wantDistribution = false;
	let md = def.description();
	md += `, expecting **${def.expect()}**`;
	if (wantAllDice) {
		let roll = def.roll();
		md += `\nRoll: **${roll.result}**`;
		md += "\n" + fmt.tbl({
			cols: roll.dice.map((_, i) => i+1),
			rows: [roll.dice]
		});
	} else if (wantRoll) {
		md += `\nRoll: **${def.sum()}**`
	}
	if (wantDistribution) {
		md += "\n## Distribution:\n" + def.distribution().md();
	}
	return md;
}

function showDefScalar(def, operator, scalar){
	let md = def.description();
	let p = def.distribution().compareToScalar(operator, scalar);
	md += `\nProbability to have ${def.str()} ${operator.name} ${scalar} : **${fmt.float(p*100)}%**`;
	if (def.N>1 && def.N*def.S<=5000) {
		md += "\n## Distribution:\n" + def.distribution().md();
	}
	return md;
}

function showDefDef(defA, operator, defB){
	let md = "";
	let distA = defA.distribution();
	let distB = defB.distribution();
	let p = distA.compareToDistribution(operator, distB);
	md += `\nProbability to have ${defA.str()} ${operator.name} ${defB.str()} : **${fmt.float(p*100)}%**`;
	let min = Math.min(distA.minPossibleValue(), distB.minPossibleValue());
	let max = Math.max(distA.maxPossibleValue(), distB.maxPossibleValue());
	if (max-min<=500) {
		md += "\n## Distribution:\n";
		let rows = [];
		for (let v=min; v<=max; v++) {
			let pa = distA.probability(v);
			let pb = distB.probability(v);
			if (pa+pb<10**-10) continue;
			rows.push([v, `${fmt.float(pa*100)}%`, `${fmt.float(pb*100)}%`]);
		}
		md += "#graph(hideTable,compare)\n" + fmt.tbl({
			cols: ["value", `proba(${defA.str()})`, `proba(${defB.str()})`],
			aligns: "rcc",
			rows
		});
	}
	return md;
}

function onCommand(ct){
	let match = ct.args.match(/^\s*(\d*\s*d\s*[\d+-]+)(?:\s*([<>=]+)\s*([\w+-]+))?\s*$/i);
	if (!match) throw new Error("Invalid command");
	let [, left, op, right] = match;
	let leftDef = new DiceRollDefinition(left);
	let md;
	if (op) {
		let operator = operators[op];
		if (!operator) throw new Error("Unknown Operator: "+op);
		if (right==+right) {
			md = showDefScalar(leftDef, operator, +right);
		} else {
			let rightDef = new DiceRollDefinition(right);
			md = showDefDef(leftDef, operator, rightDef);
		}
	} else {
		md = showDef(leftDef, true, true, true);
	}
	let duration = ct.end();
	md += `\n*duration: ${duration}µs*`;
	ct.reply(md, md.length>800);
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name: 'dice',
		fun: onCommand,
		help: "roll some dice. Exemple: `!!dice 3D24`",
		detailedHelp: "Examples:"
			+ "\n* `!!dice D6`"
			+ "\n* `!!dice 2D6+5`"
			+ "\n* `!!dice 7d24`"
	});
}
