var	url = require('url');

// from the jquery-like context of the input page
// build and return the html to send to the clients
function abstract($, line){
	var	$box = $('<div/>').addClass('wikipedia'),
		$abstract = $('<div/>').addClass('abstract');
	$box.append(
		$('<a>').attr('href', line).css('text-decoration','none').attr('title',"Click here to jump to the whole article")
		.append('<img class=wikipedia-icon src=static/plugins/wikipedia/rsc/Wikipedia-globe-icon.png align=left>')
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
		return url.resolve(line, u)
	}).attr('target','_blank');
	$box.find('img:not(.wikipedia-icon)').attr('src', function(_,u){
		return url.resolve(line, u)
	});
	$box.append('<div style="clear:both"/>');
	return $('<div>').append($box).html();
}

exports.init = function(miaou){
	miaou.pageBoxer.register({
		pattern:/^\s*https?:\/\/\w{2}\.wikipedia\.org\/[^ ]*\s*$/,
		box:abstract
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
		help:"display the relevant Wikipedia page in the language of the room. Example : `!!wiki Neil Armstrong`",
		detailedHelp:"You may also simply paste the URL of a wikipedia page to have it abstracted for you.\n"+
			"Example: `http://fr.wikipedia.org/wiki/Chat`"
	});
}
