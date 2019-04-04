let fmt;
let bench;
let graph;

exports.init = async function(miaou){
	fmt = miaou.lib("fmt");
	bench = miaou.lib("bench");
	graph = miaou.plugin("graph");
}

// compute an array where arr[k] is the number of possible rolls
//  of N S-sided dice whose summed result is k
// N and S must be integers and greater than 1.
// TODO use symetry to compute (and return) only half the array
function computeCombinations(N, S){
	if (N===1) {
		let arr = Array(S+1).fill(1);
		arr[0] = 0;
		return arr;
	}
	const p = computeCombinations(N-1, S);
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

class DiceRollDistribution{
	constructor(N, S, C=0){
		this.aN = Math.abs(N);
		if (this.aN<1) throw new Error("Dice underflow - Nothing to roll");
		if (this.aN>500) throw new Error("Dice overflow - Board is flooded");
		if (S<1) throw new Error("Dice too weird - Sides not found");
		if (S==1) throw new Error("Don't know how to roll a Möbius die");
		if (S>200) throw new Error("Dice too spherical - Never stops rolling");
		let bo = bench.start("Dice Distribution");
		this.N = N;
		this.S = S;
		this.C = C;
		this._combinations = computeCombinations(this.aN, S);
		this.totalCombinations = this._combinations.reduce((s, c)=>s+c, 0);
		this.safe = this.totalCombinations < Number.MAX_SAFE_INTEGER;
		bo.end();
		this.min = this.N + this.C; // min possible value
		this.max = this.N*this.S + this.C; // max possible value
		if (this.N<0) [this.min, this.max] = [this.max, this.min];
	}
	// return the number of ways you can get a possible value (must be an integer).
	//  distrib.combinations(3)/distrib.totalCombinations is the probability
	//  you get 3 by rolling the dice
	combinations(v){
		if (v < this.min || v > this.max) return 0;
		return this._combinations[Math.abs(v-this.C)];
	}
	probability(value){
		return this.combinations(value) / this.totalCombinations;
	}
	// compute the probability that the (in)equation is verified
	compareToScalar(operator, scalar){
		let sum = 0;
		for (let v=this.min; v<=this.max; v++) {
			if (operator(v, scalar)) sum += this.combinations(v);
		}
		return sum / this.totalCombinations;
	}
	// compute the probability that the (in)equation is verified
	compareToDistribution(operator, b){
		// TODO switch to bigint as soon as possible!
		let a = this;
		let sum = 0;
		for (let va=a.min; va<=a.max; va++) {
			let ia = Math.abs(va-a.C);
			for (let vb=b.min; vb<=b.max; vb++) {
				if (!operator(va, vb)) continue;
				let ib = Math.abs(vb-b.C);
				sum += a._combinations[ia]*b._combinations[ib];
			}
		}
		return sum / (a.totalCombinations*b.totalCombinations);
	}
	md(){
		let rows = [];
		for (let v=this.min; v<=this.max; v++) {
			let p = this.probability(v);
			if (p<10**-20) continue;
			rows.push([v, `${fmt.float(p*100)}%`]);
		}
		let md = graph.pragma({
			hideTable: true,
			nox: rows.length>100
		}) + fmt.tbl({
			cols: ["value", "probability"],
			aligns: "rl",
			rows
		});
		return md;
	}

}

exports.DiceRollDistribution = DiceRollDistribution;
