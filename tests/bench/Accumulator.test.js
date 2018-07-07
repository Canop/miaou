let	Accumulator = require("../../libs/bench.js").Accumulator,
	M = 1000*1000;

describe("compute stats by accumulation", ()=>{
	test("simple serie", function(){
		let a = new Accumulator();
		[3, 5, 6, 4, 4, 1, 2, 7].forEach(v=> a.add(v));
		expect(a.avg()).toBe(4);
		expect(a.populationVariance()).toBe(3.5);
		expect(a.sampleVariance()).toBe(4);
		expect(a.stdDev()).toBe(Math.sqrt(3.5));
	});
	test("constant (1M x 1)", function(){
		let a = new Accumulator();
		for (let i=0; i<M; i++) a.add(1);
		expect(a.avg()).toBe(1);
		expect(a.stdDev()).toBe(0);
	});
	test("constant (100M x 1M)", function(){
		let a = new Accumulator();
		for (let i=0; i<100*M; i++) a.add(M);
		expect(a.n).toBe(100*M);
		expect(a.avg()).toBe(M);
		expect(a.stdDev()).toBe(0);
	});
	test("medium serie", function(){
		let a = new Accumulator();
		for (let i=0; i<500; i++) {
			a.add(10000000);
			a.add(10010000);
			a.add(10011000);
			a.add(10011100);
		}
		// Note that we use "near" because the precision of our computer isn't that great
		expect(a.populationVariance()).toBeCloseTo(21651875)
		expect(a.stdDev()).toBeCloseTo(4653.1575301);
	});
});

