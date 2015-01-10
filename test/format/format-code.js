var fmt = require("./miaou.format.node.js").mdToHtml,
	buster = require("buster");
	
function t(s,r){
	return function(){
		buster.assert.equals(fmt(s), r);		
	}
}

buster.testCase("Formatting - Code", {
	"inlined code": t(
		"A line with `**inlined** _code_` and an equation : `y = 2*x`",
		'A line with <code>**inlined** _code_</code> and an equation : <code>y = 2*x</code>'
	),
	"Code bloc with tabs": t(
		"A code block :\n\t#html, #result {\n\tpadding: 1%;\n\tmargin : 0.5%;\n\tbackground: white;\n\t}",
		'A code block :<br><pre><code>\t#html, #result {\n\tpadding: 1%;\n\tmargin : 0.5%;\n\tbackground: white;\n\t}</code></pre>'
	),
	"Code bloc with spaces": t(
		"    function t(s,r){\n"+
		"        return function(){\n"+
		"            buster.assert.equals(fmt(s), r);\n"+
		"        }\n"+
		"    }",
		'<pre><code>    function t(s,r){\n        return function(){\n            buster.assert.equals(fmt(s), r);\n        }\n    }</code></pre>'
	),
});



