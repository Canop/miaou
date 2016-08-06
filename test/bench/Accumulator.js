var	Accumulator = require("../../libs/bench.js").Accumulator,
	M = 1000*1000, // I'm very bad at counting zeros
	buster = require("buster");
	

buster.testCase("simple stats", {
	"simple serie": function(){
		var a = new Accumulator();
		[3, 5, 6, 4, 4, 1, 2, 7].forEach(v=> a.add(v));
		buster.assert.equals(a.avg(), 4);
		buster.assert.equals(a.populationVariance(), 3.5);
		buster.assert.equals(a.sampleVariance(), 4);
		buster.assert.equals(a.stdDev(), Math.sqrt(3.5));
	},
	"constant (1M x 1)": function(){
		var a = new Accumulator();
		for (var i=0; i<M; i++) a.add(1);
		buster.assert.equals(a.avg(), 1);
		buster.assert.equals(a.stdDev(), 0);
		buster.assert.equals(a.naiveStdDev(), 0);
	},
	"constant (100M x 1M)": function(){
		var a = new Accumulator();
		for (var i=0; i<100*M; i++) a.add(M);
		buster.assert.equals(a.n, 100*M);
		buster.assert.equals(a.avg(), M);
		buster.assert.equals(a.stdDev(), 0);
	},
	"medium serie": function(){
		var a = new Accumulator();
		for (var i=0; i<500; i++) {
			a.add(10000000);
			a.add(10010000);
			a.add(10011000);
			a.add(10011100);
		}
		// Note that we use "near" because the precision of our computer isn't that great
		buster.assert.near(a.populationVariance(), 21651875, 1e-6);
		buster.assert.near(a.stdDev(), 4653.1575301, 1e-4);
	}

});
