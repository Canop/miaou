const DiceRollDistribution = require("./DiceRollDistribution.js");

class DiceRoll{
	constructor(dice, result){
		this.dice = dice;
		this.result = result;
	}
}

class DiceRollDefinition{
	constructor(str){
		let m = str.match(/^(\d+)?\s*d\s*(\d+)\s*([+-]\s*\d+)?$/i);
		if (!m) throw new Error("invalid syntax");
		this.N = +m[1]||1;	// N : number of dice rolled
		this.S = +m[2]; 	// S : number of sides on each die
		this.C = m[3] ? +(m[3].replace(/\s+/, '')) : 0;  // C : constant added after all rolls
	}
	str(){
		let s = this.N+"D"+this.S;
		if (this.C>0) s += "+" + this.C;
		else if (this.C<0) s += this.C;
		return s;
	}
	description(){
		let md = `Rolling ${this.N} ${this.S}-sided dice`;
		if (this.C>0) md += ` and adding ${this.C}`;
		else if (this.C<0) md += ` and substracting ${-this.C}`;
		return md;
	}
	// rolls all dice and compute the result (including the constant C)
	// Individual dice rolls are returned so this function shouldn't be
	//	used when N is big.
	roll(){
		let dice = Array(this.N);
		let result = this.C;
		for (let i=this.N; i--;) {
			result += dice[i] = Math.ceil(Math.random()*this.S);
		}
		return new DiceRoll(dice, result);
	}
	// compute the result but only returns the numerical sum
	sum(){
		let result = this.C;
		for (let i=this.N; i--;) {
			result += Math.ceil(Math.random()*this.S);
		}
		return result;
	}
	// return the expected value (mean of the distribution)
	expect(){
		return this.C + this.N*(this.S+1)/2;
	}
	distribution(){
		return new DiceRollDistribution(this.N, this.S, this.C);
	}
}

module.exports = DiceRollDefinition;
