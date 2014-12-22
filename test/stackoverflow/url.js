var	buster = require("buster"),
	boxer = require('../../plugins/stackoverflow/soboxer.js');


function c(text, type, num){
	return function(){
		var tasks = boxer.rawTasks(text);
		if (!type) {
			buster.assert.equals(tasks.length, 0);
			return;
		}
		buster.assert.equals(tasks.length, 1);
		buster.assert.equals(tasks[0].type, type);
		buster.assert.equals(tasks[0].num, num);
	}
}

buster.testCase("StackExchange URL Analyzing", {
    "nothing": c("http://stackoverflow.com/questions/"),
    "SO question": c("http://stackoverflow.com/questions/11353679/whats-the-recommended-way-to-connect-to-mysql-from-go", "SO question", 11353679),
    "SO comment": c("http://stackoverflow.com/questions/11353679/whats-the-recommended-way-to-connect-to-mysql-from-go#comment23781666_11357116", "SO comment", 23781666),
    "SO answer": c("http://stackoverflow.com/questions/11353679/whats-the-recommended-way-to-connect-to-mysql-from-go/11357116#11357116", "SO answer", 11357116)
});
