// box xkcd links

function abstract($, line){
	var	$box = $('<div/>').addClass('xkcd'),
		$abstract = $('<div/>').addClass('abstract'),
		$comic = $('#middleContainer');
	if (!$comic.length) {
		return null;
	}
	$box.append($abstract);
	$abstract.append($("<h1>").append(
		$("<a>").attr("href", line).attr("target", "_blank").text(
			"XKCD: " + $("#ctitle").text()
		)
	));
	$abstract.append($("<p>").append($('#comic img')));
	return $('<div>').append($box).html();
}

exports.init = function(miaou){
	miaou.pageBoxer.register({
		name: "xkcd",
		pattern:/^\s*https?:\/\/(www\.)?xkcd\.com\/[0-9]*\/\s*$/,
		box:abstract
	});
}
