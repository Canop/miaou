
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
		if (N<2||N>500) throw new Error("Invalid N");
		if (S<2||S>200) throw new Error("Invalid S");
		let bo = bench.start("Dice Distribution");
		this.N = N;
		this.S = S;
		this.C = C;
		this._combinations = computeCombinations(N, S);
		this.totalCombinations = this._combinations.reduce((s, c)=>s+c, 0);
		this.safe = this.totalCombinations < Number.MAX_SAFE_INTEGER;
		bo.end();
		//if (!this.safe) {
		//	// in the future we might switch to a normal law instead of doing the exact combination
		//	//  when N is big enough
		//	console.log("Dice Roll Distribution: integer overflow!");
		//	console.log('totalCombinations:', this.totalCombinations);
		//}
	}
	minPossibleValue(){
		return this.N + this.C;
	}
	maxPossibleValue(){
		return this.N*this.S + this.C;
	}
	// returns the number of ways you can get a possible value (must be an integer).
	//  distrib.combinations(3)/distrib.totalCombinations is the probability
	//  you get 3 by rolling the dice
	combinations(value){
		let v = value - this.C;
		if (v < this.N || v > this.N*this.S) return 0;
		return this._combinations[v];
	}
	probability(value){
		return this.combinations(value) / this.totalCombinations;
	}
	// compute the probability that the (in)equation is verified
	compareToScalar(operator, scalar){
		let sum = 0;
		for (let v=this.N*this.S; v>=this.N; v--) {
			if (operator(v+this.C, scalar)) sum += this._combinations[v];
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
		for (let i=a.N*a.S; i>=a.N; i--) {
			let va = i+a.C;
			for (let j=b.N*b.S; j>=b.N; j--) {
				let vb = j+b.C;
				if (operator(va, vb)) {
					sum += a._combinations[i]*b._combinations[j];
				}
			}
		}
		return sum / (a.totalCombinations*b.totalCombinations);
	}
	md(){
		let rows = [];
		for (let v=this.minPossibleValue(), max=this.maxPossibleValue(); v<=max; v++) {
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
