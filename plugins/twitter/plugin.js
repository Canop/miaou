
var	url = require('url');

// from the jquery-like context of the input page
// build and return the html to send to the clients
function abstract($, line){
	var	$box = $('<div/>').addClass('twitter'),
		$abstract = $('<div/>').addClass('abstract'),
		$tweet = $('.tweet').eq(0),
		$tweetHead = $tweet.find('.content').eq(0),
		time = $('#page-container .client-and-actions .metadata').eq(0).text(),
		$text = $('#page-container .tweet-text').eq(0),
		$media = $('#page-container .cards-media-container').eq(0)
	
	$box
	.append(
		$('<div>').addClass('tweet-first-line')
		.append($('<a><span>&#xe81e;</span></a>').attr('href',line).addClass('twitter-icon'))
		.append($tweetHead.find('.avatar'))
		.append(
			$('<div>').addClass('tweet-core')
			.append($tweetHead.find('.fullname'))
			.append($tweetHead.find('.username'))
			.append($('<a>').addClass('time').text(time).attr('href',line))
			.append($text)
		)
	)
	.append($media)
	$box.find('a').attr('target','_blank');
	return $('<div>').append($box).html();
}

exports.init = function(miaou){
	miaou.pageBoxer.register({
		pattern:/^\s*https?:\/\/twitter\.com\/\w+\/status\/\d+\s*$/,
		box:abstract
	});
}

