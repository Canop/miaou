
// from the jquery-like context of the input page
// build and return the html to send to the clients
function abstract($, line){
	var	$box = $('<div/>').addClass('twitter'),
		$twitterBody = $('#permalink-overlay, #permalink-overlay-body, body').eq(0),
		$tweet = $twitterBody.find('.tweet').last(),
		$tweetHead = $tweet.find('.content'),
		time = $twitterBody.find('.client-and-actions .metadata').eq(0).text(),
		$text = $twitterBody.find('.tweet-text').eq(0),
		$media = $twitterBody.find('.cards-media-container').eq(0);
	$box
	.append(
		$('<div>').addClass('tweet-first-line')
		.append($('<a>').attr('href', line).append($("<i>").addClass("icon-twitter")))
		.append($tweetHead.find('.avatar'))
		.append(
			$('<div>').addClass('tweet-core')
			.append($tweetHead.find('.fullname'))
			.append($tweetHead.find('.username'))
			.append($('<a>').addClass('time').text(time).attr('href', line))
			.append($text)
		)
	)
	.append($media)
	$box.find('a').attr('target', '_blank').attr('href', function(_, href){
		if (/^https?:\/\/t\.co/.test(href)) {
			var expandedUrl = $(this).data("expanded-url");
			if (expandedUrl) return expandedUrl;
		}
		return href[0]==='/' ? 'https://twitter.com'+href : href;
	});
	return $('<div>').append($box).html();
}

exports.init = function(miaou){
	miaou.lib("page-boxers").register({
		name: "Twitter",
		pattern:/^\s*https?:\/\/twitter\.com\/\w+\/status\/\d+\s*$/,
		box:abstract
	});
}

