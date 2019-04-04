const {DiceRollDistribution} = require("./DiceRollDistribution.js");

class DiceRoll{
	constructor(dice, result){
		this.dice = dice;
		this.result = result;
	}
}

// A Dice Roll Definition is NdS+C, for example 3D5-4
//   N is the number of dice (may be negative)
//   S is the number of sides per die
//   C is the added constant (may be negative)
class DiceRollDefinition{
	constructor(str){
		let m = str.match(/^(-?\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?$/i);
		if (!m) throw new Error("invalid syntax");
		this.N = +m[1];	// N : number of dice rolled (possibly negative)
		this.aN = Math.abs(this.N);
		if (this.aN<1) throw new Error("Can't roll zero dice");
		this.S = +m[2];	// S : number of sides on each die
		this.C = m[3] ? +(m[3].replace(/\s+/, '')) : 0;  // C : constant added after all rolls
	}
	str(){
		let s = this.N+"D"+this.S;
		if (this.C>0) s += "+" + this.C;
		else if (this.C<0) s += this.C;
		return s;
	}
	description(){
		let md = `Roll ${this.aN} ${this.S}-sided dice`;
		if (this.N<0) md += " reverse the sum"
		if (this.C>0) md += ` and add ${this.C}`;
		else if (this.C<0) md += ` and substract ${-this.C}`;
		return md;
	}
	// rolls all dice and compute the result (including the constant C)
	// Individual dice rolls are returned so this function shouldn't be
	//	used when N is big.
	roll(){
		let dice = Array(this.aN);
		let result = 0;
		for (let i=this.aN; i--;) {
			result += dice[i] = Math.ceil(Math.random()*this.S);
		}
		if (this.N<0) result = -result;
		result += this.C;
		return new DiceRoll(dice, result);
	}
	// compute the result but only returns the numerical sum
	sum(){
		let result = 0;
		for (let i=this.aN; i--;) {
			result += Math.ceil(Math.random()*this.S);
		}
		if (this.N<0) result = -result;
		result += this.C;
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
