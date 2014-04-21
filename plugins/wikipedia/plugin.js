var request = require('request'),
	url = require('url'),
	$$ = require('cheerio'),
	cache = require('bounded-cache')(200),
	Deque = require("double-ended-queue"),
	TTL = 30*60*1000,
	tasks = new Deque(100), currentTask;

function dequeue(){
	if (currentTask) return;
	var task = tasks.shift();
	if (!task) return;
	currentTask = task;
	var box = cache.get(task.line);
	if (box !== undefined) {
		console.log('wikipedia box', task.line, 'found in cache');
		return setTimeout(function(){
			currentTask = null;
			if (box) task.send('box', {mid:task.mid, from:task.line, to:box});
			dequeue();
		}, 0);
	}
	request(task.line, function(error, res, body){
		console.log('wikipedia box', task.line, 'fetched');
		currentTask = null;
		setTimeout(dequeue, 0);
		if (error || res.statusCode!==200) {
			cache.set(task.line, null, TTL);
			return;
		}
		var	$ = $$.load(body),
			$box = $('<div/>'),
			$abstract = $('<div/>').addClass('abstract'),
			$txt = $('<div/>').addClass('txt');
		$box.append(
			$('<a>').attr('href',task.line).css('text-decoration','none')
			.append('<img style="margin:3px;max-height:40px" src=http://en.wikipedia.org/favicon.ico align=left>')
			.append($('h1'))
		);
		$box.append($('<hr style="clear:both">'));
		$box.append($abstract);
		$abstract.append(
			$('table img, img.thumbimage').filter(function(){
				return !$(this).closest('.metadata').length
			}).first().addClass('mainimg').removeAttr('height').removeAttr('width')
		);
		$abstract.append($txt);
		$('p').each(function(){
			var $this = $(this);
			if (!$this.closest('div[class*="infobox"],table').length){
				for(;;) {
					$txt.append($this.clone());
					$this = $this.next();
					if (!$this.length || $this[0].name !== 'p') return false; 
				}
			}
		});
		$box.find('a[href]').attr('href', function(_,u){
			return url.resolve(task.line, u)
		}).attr('target','_blank');
		$box.find('img').attr('src', function(_,u){
			return url.resolve(task.line, u)
		});
		$box.append('<div style="clear:both"/>');
		box = $box.html();
		cache.set(task.line, box, TTL);
		task.send('box', {mid:task.mid, from:task.line, to:box});
	});
}

function onCommand(cmd, shoe, m){
	var lines = m.content.split('\n');
	var searched = lines[0].slice('!!wiki'.length).trim();
	if (searched) {
		lines[0] = 'http://en.wikipedia.org/wiki/'+encodeURIComponent(searched);
		m.content = lines.join('\n');
	} else {
		throw 'Bad syntax. Use `!!'+cmd+' what you want to search on wikipedia`';
	}
}


exports.registerCommands = function(cb){
	cb('wiki', onCommand);
}

// intercepts links to wikipedia and sends boxed abstracts.
// It directly fetches the page because I don't find anything usable
//  for representation using the Wikipedia API.
// Requests are queued and only one at a time is done.
exports.onSendMessage = function(shoe, m, send){
	m.content.split('\n').filter(function(line){
		return /^\s*https?:\/\/\w{2}\.wikipedia\.org\/[^ ]*\s*$/.test(line)
	}).forEach(function(line){
		tasks.push({line:line.trim(), mid:m.id, send:send});
		dequeue();
	});
}
