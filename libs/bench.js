"use strict";
// Record durations of measured operations and gives stats
// on !!perfs command
//
// To record an operation do
// 	let benchOperation = bench.start("some name");
// 	... do the thing here, might be asynchronous and even recursive
// 	benchOperation.end();
//
// all timings here are in microseconds

const	process = require("process"),
	benchs = new Map;

exports.configure = function(_miaou){
	return this;
}

class Bench{
	constructor(name){
		this.name = name;
		this.n = 0; // number of completed operations
		this.durationSum = 0;
		this.durationSquareSum = 0;
	}
	add(micros){
		this.n++;
		this.durationSum += micros;
		this.durationSquareSum += micros*micros;
	}
	avg(){
		return this.durationSum / this.n;
	}
	stdDev(){
		var s = this.durationSum/this.n;
		return Math.sqrt(this.durationSquareSum/this.n - s*s);
	}
}

class BenchOperation{
	constructor(bench){
		this.bench = bench;
		this.starthrtime = process.hrtime();
	}
	end(){
		var diff = process.hrtime(this.starthrtime);
		this.bench.add(diff[0]*1e6 + diff[1]/1e3);
	}
}

exports.dump = function(){
	console.log("======= BENCH DUMP =======");
	for (var bench of benchs.values()) {
		console.log(bench.name, " : n:", bench.n, "avg:", bench.avg(), "µs");
	}
	console.log("==========================");
}

exports.start = function(name){
	var bench = benchs.get(name);
	if (!bench) benchs.set(name, bench = new Bench(name));
	return new BenchOperation(bench);
}

function fmt(num, prec){
	if (!num) return ' ';
	var s = num<100 ? num.toFixed(prec||3) : Math.round(num).toString();
	return s.replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009");
}

function doCommand(ct){
	var c = "Miaou Server Operation Durations:\n";
	c += "Type | Operations | Average (ms) | Std Dev (ms) | Sum (s)\n";
	c += ":-|:-:|:-:|:-:|:-:\n";
	c += Array.from(benchs.values())
	.sort((a, b) =>
		a.name < b.name ? -1 : 1
	).map(b =>
		b.name + "|" + b.n  + "|" + fmt(b.avg()/1e3, 1) + "|" + fmt(b.stdDev()/1e3, 1) + "|" + fmt(b.durationSum/1e6)
	).join("\n");
	ct.reply(c);
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name:'perfs',
		fun:doCommand,
		help:"Usage : `!!perfs` lists performance information on some miaou internals",
	});
}
