(function() {
	function getParameterByName(search, name) {
		var match = RegExp('[?&]' + name + '=([^&]*)').exec(search);
		return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
	}

	function getEmbedLink(id) {
		return 'https://www.youtube.com/embed/' + id;
	}

	function replaceLink($c, m) {
		var hasYoutubeLink = false;
		var lines = m.content.split('<br>').map(function(line) {
			var match = line.match(/^\s*https?:\/\/www\.youtube\.com\/watch.*[\?&]v=([a-zA-Z0-9]+)[&#\w\d=]*\s*$/);
			if (!match) return line;

			hasYoutubeLink = true;
			return '<iframe width="500" height="300" src="' +
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
