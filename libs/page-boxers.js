var	request = require('request'),
	url = require('url'),
	$$ = require('cheerio'),
	cache = require('bounded-cache')(300),
	Deque = require("double-ended-queue"),
	TTL = 30*60*1000,
	boxers = [], // boxers: {pattern,box(function),TTL}
	tasks = new Deque(200),
	currentTask;

exports.register = function(boxer){
	boxer.TTL = boxer.TTL || TTL;
	boxers.push(boxer);
}

function dequeue(){
	if (currentTask) return;
	var task = tasks.shift();
	if (!task) return;
	currentTask = task;
	var box = cache.get(task.line);
	if (box !== undefined) {
		console.log('box', task.line, 'found in cache');
		return setTimeout(function(){
			currentTask = null;
			if (box) task.send('box', {mid:task.mid, from:task.line, to:box});
			dequeue();
		}, 50);
	}
	request(task.line, function(error, res, body){
		console.log('box', task.line, 'fetched');
		currentTask = null;
		setTimeout(dequeue, 0);
		if (error || res.statusCode!==200) {
			cache.set(task.line, null, TTL);
			return;
		}
		var box = task.boxer.box($$.load(body),task.line);
		cache.set(task.line, box, task.boxer.TTL);
		task.send('box', {mid:task.mid, from:task.line, to:box});
	});
}

// intercepts links and sends boxed abstracts.
// Requests are queued and only one at a time is done.
exports.onSendMessage = function(shoe, m, send){
	if (!m.content || !m.id ||!boxers.length) return;
	m.content.split('\n').forEach(function(line){
		for (var i=0; i<boxers.length; i++) {
			if (boxers[i].pattern.test(line)) {
				console.log("new task");
				tasks.push({line:line.trim(), mid:m.id, send:send, boxer:boxers[i]});
				dequeue();
				return;
			}
		}
	});
}

