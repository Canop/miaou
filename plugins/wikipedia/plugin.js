var request = require('request'),
	url = require('url'),
	$$ = require('cheerio'),
	cache = require('bounded-cache')(300),
	Deque = require("double-ended-queue"),
	TTL = 30*60*1000,
	tasks = new Deque(200), currentTask;

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
		}, 50);
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
			$abstract = $('<div/>').addClass('abstract');
		$box.append(
			$('<a>').attr('href',task.line).css('text-decoration','none').attr('title',"Click here to jump to the whole article")
			.append('<img style="margin:3px;max-height:40px" src=http://en.wikipedia.org/favicon.ico align=left>')
			.append($('h1'))
		);
		$box.append($('<hr style="clear:both">'));
		$box.append($abstract);
		var wholeHTML = $('#mw-content-text').html();
		if (wholeHTML.length>10 && wholeHTML.length<15000) {
			$abstract.html(wholeHTML);
		} else {
			var $txt = $('<div/>').addClass('txt');
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
		}
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

function onCommand(ct){
	var	m = ct.message,
		done = false;
	m.content = m.content.replace(/!!wiki\s+([^\s\n][^\n]+)/, function(_, searched, pos){
		done = true;
		var r = 'http://'+ct.shoe.room.lang+'.wikipedia.org/wiki/'+encodeURIComponent(searched.trim());
		if (pos>3) r = '\n'+r; // due to how commands are parsed, it can only be after a ping or a reply
		return r;
	});
	if (!done) throw 'Bad syntax. Use `!!wiki what you want to search on wikipedia`';
}

exports.registerCommands = function(cb){
	cb({
		name:'wiki', fun:onCommand,
		help:"displays the relevant Wikipedia page in the language of the room. Example : `!!wiki Neil Armstrong`",
		detailedHelp:"You may also simply paste the URL of a wikipedia page to have it abstracted for you.\n"+
			"Example: `http://fr.wikipedia.org/wiki/Chat`"
	});
}

// intercepts links to wikipedia and sends boxed abstracts.
// It directly fetches the page because I don't find anything usable
//  for representation using the Wikipedia API.
// Requests are queued and only one at a time is done.
exports.onSendMessage = function(shoe, m, send){
	if (!m.content || !m.id) return;
	m.content.split('\n').filter(function(line){
		return /^\s*https?:\/\/\w{2}\.wikipedia\.org\/[^ ]*\s*$/.test(line)
	}).forEach(function(line){
		tasks.push({line:line.trim(), mid:m.id, send:send});
		dequeue();
	});
}
