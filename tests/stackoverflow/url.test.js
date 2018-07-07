const boxer = require('../../plugins/stackoverflow/se-boxer.js');

function c(text, site, meta, type, num){
	return function(){
		var tasks = boxer.rawTasks(text);
		if (!site) {
			expect(tasks.length).toBe(0);
			return;
		}
		expect(tasks.length).toBe(1);
		expect(tasks[0].site).toBe(site);
		expect(tasks[0].meta).toBe(meta);
		expect(tasks[0].type).toBe(type);
		expect(tasks[0].num).toBe(num);
	}
}

const doTests = function(name, tests){
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

doTests("StackExchange URL Analyzing", {
	"nothing": c(
		"http://stackoverflow.com/questions/"
	),
	"SO question": c(
		"http://stackoverflow.com/questions/11353679/whats-the-recommended-way-to-connect-to-mysql-from-go",
		"stackoverflow", false, "questions", 11353679
	),
	"SO comment 1": c(
		"http://stackoverflow.com/questions/11353679/whats-the-recommended-way-to-connect-to-mysql-from-go#comment23781666_11357116",
		"stackoverflow", false, "comments", 23781666
	),
	"SO comment 2": c(
		"http://stackoverflow.com/questions/27797971/how-to-decode-this-im-really-having-hard-time/27798176#comment44004900_27798176",
		"stackoverflow", false, "comments", 44004900
	),
	"SO answer": c(
		"http://stackoverflow.com/questions/11353679/whats-the-recommended-way-to-connect-to-mysql-from-go/11357116#11357116",
		"stackoverflow", false, "answers", 11357116
	),
	"Meta StackExchange answer": c(
		"http://meta.stackexchange.com/questions/203346/flags-in-chat-are-defective-by-design/204564#204564",
		"stackexchange", true, "answers", 204564
	),
	"AskUbuntu question": c(
		"http://askubuntu.com/questions/339354/cant-alloc-filename-when-executing-mdb-export-on-a-mounted-file",
		"askubuntu", false, "questions", 339354
	),
	"Meta AskUbuntu question": c(
		"http://meta.askubuntu.com/questions/7070/do-users-have-to-lose-their-sense-of-humour-to-answer-questions-on-the-askubuntu",
		"askubuntu", true, "questions", 7070
	),
	"SuperUser answer": c(
		"http://superuser.com/questions/308771/why-are-we-still-using-cpus-instead-of-gpus/308779#308779",
		"superuser", false, "answers", 308779
	),
	"SO answer share": c(
		"http://stackoverflow.com/a/17781189/263525",
		"stackoverflow", false, "answers", 17781189
	),
	"Meta askubuntu share without user": c(
		"http://meta.askubuntu.com/q/7070",
		"askubuntu", true, "questions", 7070
	)
});

