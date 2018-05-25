
const fmt = require("../../libs/fmt.js");
const bench = require("../../libs/bench.js");

// compute an array where arr[k] is the number of possible rolls
//  of N S-sided dice whose summed result is k
// N and S must be integers and greater than 1.
// TODO use symetry to compute (and return) only half the array
// TODO don't start arrays at 0 (i.e. make it so that arr[k] is the proba of k+N) ?
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
		if (this.aN<2||this.aN>500) throw new Error("Invalid N");
		if (S<2||S>200) throw new Error("Invalid S");
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
	// returns the number of ways you can get a possible value (must be an integer).
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
			if (operator(v+this.C, scalar)) sum += this._combinations[Math.abs(v)];
		}
		return sum / this.totalCombinations;
	}
	// compute the probability that the (in)equation is verified
	compareToDistribution(operator, b){
		// this could be greatly optimized, and we should better estimate
		//  the impacts of the inevitable overflows
		// TODO switch to bigint as soon as possible!
		let a = this;
		let sum = 0;
		for (let i=a.min; i<=a.max; i++) {
			let va = i+a.C;
			let absi = Math.abs(i);
			for (let j=b.min; j<=b.max; j++) {
				let vb = j+b.C;
				let absj = Math.abs(j);
				if (operator(va, vb)) {
					sum += a._combinations[absi]*b._combinations[absj];
				}
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
		let md = "#graph(hideTable)\n" + fmt.tbl({
			cols: ["value", "probability"],
			aligns: "rl",
			rows
		});
		return md;
	}

}

module.exports = DiceRollDistribution;
