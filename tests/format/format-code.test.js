require("./format.js");

doTests("Formatting - Code", {
	"inlined code": t(
		"A line with `**inlined** _code_` and an equation : `y = 2*x`",
		'A line with <code>**inlined** _code_</code> and an equation : <code>y = 2*x</code>'
	),
	"Code bloc with tabs": t(
		"A code block :\n\t#html, #result {\n\tpadding: 1%;\n\tmargin : 0.5%;\n\tbackground: white;\n\t}",
		'A code block :<br><pre class="prettyprint">#html, #result {\npadding: 1%;\nmargin : 0.5%;\nbackground: white;\n}</pre>'
	),
	"Code bloc with spaces": t(
		"    function t(s,r){\n"+
		"        return function(){\n"+
		"            buster.assert.equals(fmt(s), r);\n"+
		"        }\n"+
		"    }",
		'<pre class="prettyprint">function t(s,r){\n    return function(){\n        buster.assert.equals(fmt(s), r);\n    }\n}</pre>'
	),
	"Code bloc with language pragma":t(
		"Here's some SQL code:\n"+
		"#lang-sql\n"+
		"    CREATE TABLE db_version (\n"+
		"    	component varchar(30) primary key,\n"+
		"    	version integer NOT NULL\n"+
		"    );\n"+
		"    insert into db_version (component, version) values('core', 14);\n",
		'Here\'s some SQL code:<br><i class="pragma pragma-lang">#lang-sql</i><br><pre class=\"prettyprint lang-sql\">CREATE TABLE db_version (\n\tcomponent varchar(30) primary key,\n\tversion integer NOT NULL\n);\ninsert into db_version (component, version) values(\'core\', 14);</pre>'
	),
	"A table in code":t(
		"	a|b↵	-|-↵	a|b",
		'<pre class="prettyprint">a|b↵	-|-↵	a|b</pre>'
	)
});

