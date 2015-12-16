var fmt = require("./miaou.format.node.js"),
	buster = require("buster");
	
function t(s,r){
	return function(){
		buster.assert.equals(fmt.mdTextToHtml(s), r);		
	}
}

buster.testCase("Formatting - Images", {
	"in code and on its own": t(
		"On the next line : ` http://dystroy.org/re7210/img/tartines-saint-jacques-850-02.jpg `\n http://dystroy.org/re7210/img/tartines-saint-jacques-850-02.jpg",
		'On the next line : <code> http://dystroy.org/re7210/img/tartines-saint-jacques-850-02.jpg </code><br><a href="http://dystroy.org/re7210/img/tartines-saint-jacques-850-02.jpg"><img src="http://dystroy.org/re7210/img/tartines-saint-jacques-850-02.jpg"></a>'
	),
	"imgur thumb gif": t(
		"http://i.imgur.com/ZYxAvjFm.gif",
		"<a href=http://i.imgur.com/ZYxAvjFm.gif><img src=http://i.imgur.com/ZYxAvjFm.gif></a>"
	),
	"imgur gif": t(
		"http://i.imgur.com/ZYxAvjF.gif",
		"<a href=http://i.imgur.com/ZYxAvjF.gif><img src=http://i.imgur.com/ZYxAvjFm.gif></a>"
	),
	"imgur gifv": t(
		"http://i.imgur.com/ZYxAvjF.gifv",
		"<a href=http://i.imgur.com/ZYxAvjF.gifv><img src=http://i.imgur.com/ZYxAvjFm.gif></a>"
	)
});
