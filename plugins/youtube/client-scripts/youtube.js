miaou(function(plugins, md){

	var regex = /^\s*<a[^>]* href="https?:\/\/(?:www\.youtube\.com\/watch[\?&#\w\d=]*[\?&]v=|youtu\.be\/)([a-zA-Z0-9-_]+)[\?&#\w\d=]*">[^<>]+<\/a>\s*$/;

	function getEmbedLink(id){
		return 'https://www.youtube.com/embed/' + id + '?html5=1';
	}

	// We want to make sure the video size isn't too big
	function calculateVideoSize($c){
		var defaultWidth = 640;
		var defaultHeight = 390;

		// The width is the value we depend on.
		var messagesDivWidth = $c.width();
		if (messagesDivWidth > defaultWidth) {
			return {width:defaultWidth, height: defaultHeight};
		}

		// If the message div is too small, we shrink the width and keep the ratio.
		// Make sure it's not *too* small though.
		if (messagesDivWidth === 0) {
			return {width:0, height: 0};
		}

		return {
			width:messagesDivWidth,
			height:(((messagesDivWidth)*defaultHeight)/defaultWidth)|0
		};
	}

	function replaceLink($c, m){
		if (!m.content || !/(?:www\.youtube\.com\/watch|youtu\.be\/)/.test(m.content)) return;
		var hasYoutubeLink = false;
		var lines = $c.html().split('<br>').map(function(line){
			var match = line.match(regex);
			if (!match) return line;
			hasYoutubeLink = true;
			// We want to calculate for each new video, the screen size may have changed.
			var size = calculateVideoSize($c);
			return '<iframe width=' + size.width +
				' height=' + size.height +
				' sandbox="allow-forms allow-scripts allow-same-origin"' +
				' src="' + getEmbedLink(match[1]) + '"' +
				' frameborder=0 allowfullscreen></iframe>';
		});
		if (hasYoutubeLink) $c.html(lines.join('<br>'));
	}

	plugins.youtube = {
		start: function(){
			// post renderer
			md.registerRenderer(replaceLink, true, true);
		}
	};
});
