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
		'A code block :<br><code class=indent>#html, #result {</code><br><code class=indent>padding: 1%;</code><br><code class=indent>margin : 0.5%;</code><br><code class=indent>background: white;</code><br><code class=indent>}</code>'
	),
	"Code bloc with spaces": t(
		"    function t(s,r){\n"+
		"        return function(){\n"+
		"            buster.assert.equals(fmt(s), r);\n"+
		"        }\n"+
		"    }",
		'<code class=indent>function t(s,r){</code><br><code class=indent>    return function(){</code><br><code class=indent>        buster.assert.equals(fmt(s), r);</code><br><code class=indent>    }</code><br><code class=indent>}</code>'
	),
});



