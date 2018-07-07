// tooling for format tests
const fmt = {};
global.miaou = function(fun){
	fun(fmt);
};
require("../../src/main-js/miaou.fmt.js");
require("../../src/main-js/miaou.fmt.Table.js");

global.t = function(s,r){
	return function(){
		expect(fmt.reset().mdTextToHtml(s)).toBe(r);
	}
}

global.doTests = function(name, tests){
	describe(name, ()=>{
		for (let k in tests) {
			if (/^\/\//.test(k)) {
				test.skip(k, tests[k]);
			} else {
				test(k, tests[k]);
			}
		}
	});
}
