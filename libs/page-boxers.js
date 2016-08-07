const	request = require('request'),
	$$ = require('cheerio'),
	bench = require('./bench.js'),
	cache = require('bounded-cache')(300),
	Deque = require("double-ended-queue"),
	TTL = 30*60*1000,
	boxers = [], // boxers: {name,pattern,box(function),TTL,urler(function)}
	tasks = new Deque(200);

let	currentTask;

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
		return setTimeout(function(){
			currentTask = null;
			if (box) task.send('box', {mid:task.mid, from:task.line, to:box});
			dequeue();
		}, 50);
	}
	var	line = task.line,
		url = line,
		benchOperation = bench.start("Boxer / " + task.boxer.name),
		args = line.match(task.boxer.pattern);
	if (task.boxer.urler) {
		url = task.boxer.urler.apply(null, args);
	}
	request(url, function(error, res, body){
		console.log('box', url, 'fetched');
		currentTask = null;
		setTimeout(dequeue, 0);
		if (error || !res || res.statusCode!==200) {
			cache.set(line, null, TTL);
			console.log("Error in box fetching", url, error);
			return;
		}
		args.unshift($$.load(body));
		var box = task.boxer.box.apply(null, args);
		cache.set(line, box, task.boxer.TTL);
		benchOperation.end();
		task.send('box', {mid:task.mid, from:line, to:box});
	});
}

// intercepts links and sends boxed abstracts.
// Requests are queued and only one at a time is done.
exports.onSendMessage = function(shoe, m, send){
	if (!m.content || !m.id ||!boxers.length) return;
	m.content.split('\n').forEach(function(line){
		for (var i=0; i<boxers.length; i++) {
			if (boxers[i].pattern.test(line)) {
				tasks.push({
					line:line.trim(),
					mid:m.id,
					send:send,
					boxer:boxers[i]
				});
				dequeue();
				return;
			}
		}
	});
}

