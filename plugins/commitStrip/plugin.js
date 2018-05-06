
// box commitStrip links

function boxedStrip($, line){
	var	$box = $('<div/>').addClass('commitStrip'),
		$comic = $('article');
	$box.append($comic);

	return $box.html();
}

exports.init = function(miaou){
	miaou.lib("page-boxers").register({
		name: "commitStrip",
		pattern: /^\s*(https?:\/\/)?www\.?xkcd\.com\/[0-9]*\/?\s*$/,
		box: abstract
	});
}
// ihavechosenthispassword4miaou@psql