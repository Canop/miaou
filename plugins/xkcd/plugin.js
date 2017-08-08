
// box xkcd links

function abstract($, line){
	var	explainBase = 'https://www.explainxkcd.com/wiki/index.php/',
		$box = $('<div/>').addClass('xkcd'),
		$abstract = $('<div/>').addClass('abstract'),
		$comic = $('#middleContainer'),
		[permaLink, id] = $('#middleContainer').text().match(
			/Permanent link to this comic: (https:\/\/xkcd.com\/([0-9]+))/
		).slice(1, 3);
	if (!$comic.length) {
		return null;
	}
	$box.append($abstract);
	$abstract.append($("<h1>").append(
		$("<a>").attr("href", permaLink).attr("target", "_blank").text(
			"XKCD: " + $("#ctitle").text()
		)
	));
	$abstract.append($("<p>").append($('#comic img')));
	$abstract.append(
		$("<a>")
		.attr("href", explainBase+id )
		.attr("target", "_blank")
		.text("Explain xkcd")
		.attr("title", "It's 'cause you're dumb.")
		.addClass("xkcd-link")
	);

	return $('<div>').append($box).html();
}

exports.init = function(miaou){
	miaou.lib("page-boxers").register({
		name: "xkcd",
		pattern: /^\s*https?:\/\/(www\.)?xkcd\.com\/[0-9]*\/?\s*$/,
		box: abstract
	});
}
