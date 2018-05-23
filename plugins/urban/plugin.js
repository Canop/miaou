// from the jquery-like context of the input page
// build and return the html to send to the clients
function abstract($, line){
	var	$box = $('<div/>').addClass('urban'),
		$abstract = $('<div/>').addClass('abstract'),
		$def = $('.def-panel').eq(0);
	$box.append($abstract);
	if ($def.length) {
		$abstract.append($("<h1>").append(
			$("<a>").attr("href", line).attr("target", "_blank").text(
				"Urban Dictionary: " + $def.find(".def-header .word").text()
			)
		));
		console.log($def.find(".meaning").html());
		$abstract.append($("<p>").text($def.find(".meaning").text()));
	} else {
		$box.append("no definition found on Urban");
	}
	return $('<div>').append($box).html();
}

exports.init = function(miaou){
	miaou.lib("page-boxers").register({
		name: "urban",
		pattern: /^\s*https?:\/\/(www\.)?urbandictionary\.com\/define\.php\?term=[^ ]*\s*$/,
		box: abstract
	});
}

function onCommand(ct){
	ct.reply('\nhttp://www.urbandictionary.com/define.php?term='+encodeURIComponent(ct.args))
	ct.end();
}

exports.registerCommands = function(cb){
	cb({
		name: 'urban',
		fun: onCommand,
		help: "display the relevant Urban Dictionary page. Example : `!!urban miaou`",
		detailedHelp: "You may also simply paste the URL of a page to have it abstracted for you."
	});
}
