
// box commitStrip links
function boxedStrip($, line){
	let $box = $('<div/>').addClass('commitStrip');
	let $art = $('article').first();
	$box.append($('header h1.entry-title', $art));
	$box.append($('header a', $art));
	$('a', $box).append($('div.entry-content', $art));
	$box = $('<div/>').append($box);
	return $box.html();
}

exports.init = function(miaou){
	miaou.lib("page-boxers").register({
		name: "commitStrip",
		pattern: /^\s*https?:\/\/www\.commitstrip\.com\/(?:en|fr)\/[0-9]{4}\/(?:[0-9]{2}\/){2}\S+\/?\s*$/,
		box: boxedStrip
	});
}
