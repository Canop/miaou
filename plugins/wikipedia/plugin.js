var request = require('request'),
	url = require('url'),
	$$ = require('cheerio'),
	cache = require('../../libs/cache.js')(500),
	Deque = require("double-ended-queue"),
	tasks = new Deque(100), currentTask;

function cake(newTask){
	if (newTask) tasks.push(newTask);
	if (currentTask) return;
	var task = tasks.shift();
	if (!task) return;
	currentTask = task;
	var box = cache.get(task.line);
	if (box) {
		console.log('wikipedia box', task.line, 'found in cache');
		return setTimeout(function(){
			currentTask = null;
			task.send('box', {mid:task.mid, from:task.line, to:box});		
			cake();
		}, 0);
	}
	request(task.line, function(error, res, body){
		currentTask = null;
		setTimeout(cake, 0);
		if (error || res.statusCode!==200) return;
		console.log('wikipedia box', task.line, 'fetched');
		var	$ = $$.load(body),
			$box = $('<div></div>');
		$box.append(
			$('<a>').attr('href',task.line).css('text-decoration','none')
			.append('<img style="margin:3px;max-height:40px" src=http://en.wikipedia.org/favicon.ico align=left>')
			.append($('h1'))
		);
		$box.append($('<hr style="clear:both">'));
		$box.append(
			$('table img, img.thumbimage').filter(function(){
				return !$(this).closest('.metadata').length
			}).first().attr('align','left').removeAttr('height').removeAttr('width').css('margin','5px')
		);
		$('p').each(function(){
			var $this = $(this);
			if (!$this.closest('div[class*="infobox"],table').length){
				$box.append($this);
				return false;
			}
		});
		$box.find('a[href]').attr('href', function(_,u){
			return url.resolve(task.line, u)
		}).attr('target','_blank');
		$box.find('img').attr('src', function(_,u){
			return url.resolve(task.line, u)
		});
		box = $box.html();
		cache.set(task.line, box);
		task.send('box', {mid:task.mid, from:task.line, to:box});
	});
}

// intercepts links to wikipedia and sends boxed abstracts.
// It directly fetches the page because I don't find anything usable
//  for representation using the Wikipedia API.
// Requests are queued and only one at a time is done.
exports.onSendMessage = function(shoe, m, send){
	m.content.split('\n').filter(function(line){
		return /^\s*https?:\/\/\w{2}\.wikipedia\.org\/[^ ]*\s*$/.test(line)
	}).forEach(function(line){
		cake({line:line.trim(), mid:m.id, send:send});
	});
}
