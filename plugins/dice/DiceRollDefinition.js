
class DiceRollDefinition{
	constructor(str){
		let m = str.match(/^(\d+)?\s*d\s*(\d+)\s*([+-]\s*\d+)?$/i);
		if (!m) throw new Error("invalid syntax");
		this.N = +m[1]||1;	// N : number of dice rolled
		this.S = +m[2]; 	// S : number of sides on each die
		this.C = m[3] ? m[3].replace(/\s+/, '') : 0;  // C : constant added after all rolls

	}

}

module.exports = DiceRollDefinition;
