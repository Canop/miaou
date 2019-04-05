miaou(function(plugins, md, prefs){

	// TODO: the following regex isn't reliable
	// We should parse the line as HTML, check it's a A element and then check the href instead
	var regex = /^\s*(<span[^>]+>[^<]+<\/span>)?\s*<a[^>]* href="https?:\/\/(?:www\.youtube\.com\/watch[\?&#\w\d=]*[\?&]v=|youtu\.be\/)([a-zA-Z0-9-_]+)(?:[?&]t=(\d+))?[\?&#\w\d=]*"( class="[^"]+")?>[^<>]+<\/a>\s*$/;

	var expand;

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

	function getEmbedLink(id, t){
		// We want to calculate for each new video, the screen size may have changed.
		var url = 'https://www.youtube.com/embed/' + id + '?html5=1';
		if (t) url += "&start="+t;
		return url;
	}

	function makeVideoHTML($c, id, t){
		var size = calculateVideoSize($c);
		return	'<iframe width=' + size.width +
			' height=' + size.height +
			' sandbox="allow-forms allow-scripts allow-same-origin"' +
			' src="' + getEmbedLink(id, t) + '"' +
			' frameborder=0 allowfullscreen></iframe>';
	}

	function handleMessage($c, m){
		if (!m.content || !/(?:www\.youtube\.com\/watch|youtu\.be\/)/.test(m.content)) return;
		var hasYoutubeLink = false;
		var lines = $c.html().split('<br>').map(function(line){
			var match = line.match(regex);
			if (!match) return line;
			hasYoutubeLink = true;
			var r;
			if (expand) {
				r = makeVideoHTML($c, match[2], match[3]);
			} else {
				r = `<i class=youtube-expander  data-yt="${match[2]},${match[3]}">▶</i>${match[0]}`;
			}
			if (match[1]) r = match[1] + "<br>" + r;
			return r;
		});
		if (hasYoutubeLink) $c.html(lines.join('<br>'));
	}

	function bindExpanders(){
		$("#messages").on("click", ".youtube-expander", function(){
			$(this).before(makeVideoHTML(
				$(this).closest(".content"), ...$(this).data("yt").split(",")
			)).add($(this).next()).remove();
		});
		$("#messages").bubbleOn(".youtube-expander", "click this icon to show the video");
	}

	plugins.youtube = {
		start: function(){
			expand = prefs.get("youtube.expand")!=="no";
			if (!expand) bindExpanders();
			md.registerRenderer(handleMessage, true, true);
		}
	};
});
