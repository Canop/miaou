// boxes StackOverflow chat messages (there's no API for that)
var	url = require('url');

// from the jquery-like context of the input page
// build and return the html to send to the clients
function abstract($, line, id){
	var	$box = $('<div/>').addClass('so-chat-message'),
		$abstract = $('<div/>').addClass('abstract'),
		$username = $('.username').eq(0),
		$message = $('#message-'+id+' .content').eq(0),
		$timestamp = $('.timestamp').eq(0);
	$box.append($abstract);
	$abstract.append($("<span class=username>").text($username.text()));
	$abstract.append($("<img>").attr("src","https://cdn.sstatic.net/stackoverflow/img/apple-touch-icon.png"));
	$abstract.append($("<a>").attr("href",line).append($timestamp));
	$abstract.append($message).find("a").attr("target","_blank");
	return $('<div>').append($box).html();
}

exports.init = function(miaou){
	miaou.pageBoxer.register({
		pattern:/^\s*https?:\/\/chat\.stackoverflow\.com\/transcript\/(?:\d+\?m=|message\/)(\d+)\S*\s*$/,
		urler:function(line, id){
			return "http://chat.stackoverflow.com/messages/"+id+"/history";
		},
		box:abstract
	});
}

