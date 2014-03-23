

var request = require('request'),
	url = require('url'),
	$$ = require('cheerio'),
	cache = require('../../libs/cache.js')(500);

// intercepts links to wikipedia and sends boxed abstracts.
// It directly fetches the page because I don't find anything usable
//  for representation using the Wikipedia API 
exports.onSendMessage = function(shoe, m, send){
	m.content.split('\n').filter(function(line){
		return /^\s*https?:\/\/\w{2}\.wikipedia\.org\/[^ ]*\s*$/.test(line)
	}).forEach(function(line){
		line = line.trim();
		var box = cache.get(line);
		console.log('wikipedia box');
		if (box) {
			console.log(' found in cache');
			return setTimeout(function(){
				send('box', box);
			},0);
		}
		console.log(' not in cache');
		request(line, function(error, res, body){
			if (!error && res.statusCode===200) {
				var	$ = $$.load(body),
					$box = $('<div></div>');
				$box.append('<img style="margin:3px;max-height:40px" src=http://en.wikipedia.org/favicon.ico align=left>');
				$box.append($('h1'));
				$box.append($('<hr style="clear:both">'));
				$box.append($('table img, img.thumbimage').first().attr('align','left').removeAttr('height').removeAttr('width').css('margin','5px'));
				$('p').each(function(){
					var $this = $(this);
					if (!$this.closest('div[class*="infobox"]').length){
						$box.append($this);
						return false;
					}
				});
				$box.find('a[href]').attr('href', function(_,u){
					return url.resolve(line, u)
				}).attr('target','_blank');
				$box.find('img').attr('src', function(_,u){
					return url.resolve(line, u)
				}).attr('target','_blank');
				box = {mid:m.id, from:line, to:$box.html() };
				cache.set(line, box);
				send('box', box);
			} else {
				console.log("request failed", error, res.statusCode);
			}
		});
		
	});

}
