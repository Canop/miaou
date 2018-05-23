const	url = require('url'),
	icon = "<img class=wikipedia-icon src=static/plugins/wikipedia/rsc/Wikipedia-globe-icon.png align=left>";

// from the jquery-like context of the input page
// build and return the html to send to the clients
function abstract($, line){
	var	$box = $('<div/>').addClass('wikipedia'),
		$abstract = $('<div/>').addClass('abstract');
	$box.append(
		$('<a>').attr('href', line).css('text-decoration', 'none')
		.attr('title', "Click here to jump to the whole article")
		.append(icon)
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
			if (!$this.closest('div[class*="infobox"],table').length) {
				for (;;) {
					$txt.append($this.clone());
					$this = $this.next();
					if (!$this.length || $this[0].name !== 'p') return false;
				}
			}
		});
	}
	$box.find('a[href]').attr('href', function(_, u){
		return url.resolve(line, u)
	}).attr('target', '_blank');
	$box.find('img:not(.wikipedia-icon)').attr('src', function(_, u){
		return url.resolve(line, u)
	});
	$box.append('<div style="clear:both"/>');
	$box.find("script,noscript").remove();
	return $('<div>').append($box).html();
}

exports.init = function(miaou){
	miaou.lib("page-boxers").register({
		name: "Wikipedia",
		pattern: /^\s*https?:\/\/(\w{2})(?:\.m)?\.wikipedia\.org\/([^ ]+)\s*$/,
		box: abstract,
		urler: function(line, lang, path){
			return `http://${lang}.wikipedia.org/${path}`;
		}
	});
}

function onCommand(ct){
	ct.reply('\nhttps://'+ct.shoe.room.lang+'.wikipedia.org/wiki/'+encodeURIComponent(ct.args));
	ct.end();
}

exports.registerCommands = function(cb){
	cb({
		name: 'wiki',
		fun: onCommand,
		help: "display the relevant Wikipedia page in the language of the room."+
			" Example : `!!wiki Neil Armstrong`",
		detailedHelp: "You may also simply paste the URL of a wikipedia page "+
			"to have it abstracted for you.\n"+
			"Example: `http://fr.wikipedia.org/wiki/Chat`"
	});
}
