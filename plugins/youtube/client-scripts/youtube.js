(function() {
	function getEmbedLink(id) {
		return 'https://www.youtube.com/embed/' + id;
	}

	// We want to make sure the video size isn't too big
	function calculateVideoSize() {
		var defaultWidth = 640;
		var defaultHeight = 390;

		// The width is the value we depend on.
		var messagesDivWidth = $('.message:first-child .content').width();
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

	function replaceLink($c, m) {
		var hasYoutubeLink = false;
		var lines = m.content.split('<br>').map(function(line) {
			var match = line.match(/^\s*https?:\/\/www\.youtube\.com\/watch.*[\?&]v=([a-zA-Z0-9]+)[&#\w\d=]*\s*$/);
			if (!match) return line;

			hasYoutubeLink = true;
			// We want to calculate for each new video, the screen size may have changed.
			var size = calculateVideoSize();
			return '<iframe width="' +
				size.width +
				'" height="' +
				size.height +
				'" src="' +
				getEmbedLink(match[1]) +
				'" frameborder="0" allowfullscreen></iframe>';
		});
		if (!hasYoutubeLink) return false;

		$c.html(lines.join('<br>'));
		return hasYoutubeLink;
	}

	miaou(function(plugins, chat, md, ms) {
		plugins.youtube = {
			start: function() {
				// post renderer
				md.registerRenderer(replaceLink, true, true);
			}
		};
	});
}());
