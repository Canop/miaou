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
		'On the next line : <code> http://dystroy.org/re7210/img/tartines-saint-jacques-850-02.jpg </code><br><img src="http://dystroy.org/re7210/img/tartines-saint-jacques-850-02.jpg">'
	),
	"imgur thumb gif": t(
		"http://i.imgur.com/ZYxAvjFm.gif",
		"<img src=http://i.imgur.com/ZYxAvjFm.gif>"
	),
	"imgur gif": t(
		"http://i.imgur.com/ZYxAvjF.gif",
		"<img href=http://i.imgur.com/ZYxAvjF.gif src=http://i.imgur.com/ZYxAvjFm.gif>"
	),
	"imgur gifv": t(
		"http://i.imgur.com/ZYxAvjF.gifv",
		"<img href=http://i.imgur.com/ZYxAvjF.gifv src=http://i.imgur.com/ZYxAvjFm.gif>"
	)
});
