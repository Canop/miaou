exports.name = "Dices";

let	fmt,
	bench;

exports.init = async function(miaou){
	fmt = miaou.lib("fmt");
	bench = miaou.lib("bench");
}

function rollDice(ct){
	let m = ct.args.match(/^\s*(\d+)?\s*d\s*(\d+)\s*([+-]\s*\d+)?/i);
	if (!m) throw "invalid syntax";
	let	nbDice = +m[1]||1,
		nbSides = +m[2],
		constant = m[3] ? +m[3].replace(/\s+/g, '') : 0;
	if (nbDice<1) throw "you can't roll less than one die";
	if (nbSides<2 || nbSides>5000) throw "there's no such die";
	if (nbDice>200) throw "Dice Overflow Error: Rolling Pad is flooded";

	let	roll = true; // do we want to roll the dice ?
	let	probas = nbDice>1 && nbDice*nbSides<900; // do we want to compute the distribution ?

	let	sum = constant,
		exp = constant,
		dice = [];
	for (let i=0; i<nbDice; i++) {
		let v = Math.ceil(Math.random()*nbSides);
		dice.push(v);
		sum += v;
		exp += (nbSides+1)/2;
	}

	let	md = 'Rolling '+nbDice+' '+nbSides+'-sided dice'+(nbDice>1?'s':'')+
		(constant ? ' and adding '+constant : '')+
		' (**expect: '+exp.toFixed(1)+'**)';

	if (roll) {
		md += "\n## Roll:";
		md += " **"+sum+"**";
		if (nbDice>1 && nbDice<=12) {
			md += "\n" + fmt.tbl({
				cols: dice.map((_, i) => i+1).concat('Sum'),
				rows: [dice.concat("**"+sum+"**")]
			});
		}
	}

	if (probas) {
		md += "\n## Distribution:";
		md += "\n#graph(hideTable)";
		let distribution = exports.distribution(nbDice, nbSides);
		md += "\n" + fmt.tbl({
			cols: ["value", "probability"],
			aligns: "rl",
			rows: distribution.map((p, i) => p ? [i+constant, `${p*100} %`]: null).filter(Boolean)
		});
	}

	ct.reply(md, md.length>800);
	ct.end();
}

// compute an array where arr[k] is the number of possible rolls
//  of N S-sided dice whose summed result is k
// N and S must be integers and greater than 1.
// TODO use symetry to compute (and return) only half the array
// TODO don't start arrays at 0 (i.e. make it so that arr[k] is the proba of k+N) ?
function _computeNumberOfWays(N, S){
	if (N===1) {
		let arr = Array(S+1).fill(1);
		arr[0] = 0;
		return arr;
	}
	const p = _computeNumberOfWays(N-1, S);
	const d = Array(p.length+S).fill(0);
	for (let k=d.length; k--;) {
		let m = Math.max(1, k-p.length+1);
		let M = Math.min(k, S);
		for (let j=m; j<=M; j++) {
			d[k] += p[k-j];
		}
	}
	return d;
}

// compute an array where arr[k] is the probability that k is the sum
//  of the visible sides when rolling N S-sided dice.
// N and S must be integers and greater than 1.
exports.distribution = function(N, S){
	if (N<2||N>200) throw new Error("Invalid N");
	if (S<2||S>200) throw new Error("Invalid S");
	const bo = bench.start("dice distribution");
	const d = _computeNumberOfWays(N, S);
	let sum = 0;
	for (let i=d.length; i--;) sum += d[i];
	for (let i=d.length; i--;) d[i] /= sum;
	bo.end();
	return d;
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name:'dice',
		fun:rollDice,
		help:"roll some dice. Exemple: `!!dice 3D24`",
		detailedHelp:"Examples:"
			+ "\n* `!!dice D6`"
			+ "\n* `!!dice 2D6+5`"
			+ "\n* `!!dice 7d24`"
	});
}
