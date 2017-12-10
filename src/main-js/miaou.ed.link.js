// link related function of the miaou editor
miaou(function(ed, fmt){

	var help = [
		"You can use a standard URL or a Miaou shortcut:",
		"* link to a room: `3#`",
		"* link to a message: `3#12345`",
		"* link to a user: `u/username`"
	];

	// opens a dialog enabling the edition of the text & url parts of a link to insert.
	// Those parts may be initialized from the selected text
	ed.onCtrlL = function(){
		var	s = this.selectionStart,
			e = this.selectionEnd,
			input = this,
			sel = input.value.slice(s, e),
			$text, $url,
			$c = $("<div class=link-ed>"); // dialog content

		function insertLink(){
			var text = $text.val();
			var url = $url.val().replace(/\(/g, '%28').replace(/\)/g, '%29');
			if (!url) return; // we can do nothing, here
			var link = text ? "["+text+"]("+url+")" : url;
			input.value = input.value.slice(0, s) + link + input.value.slice(e);
			input.focus();
		}

		$c.append(
			$("<label>").text("Text:").append(
				$text = $("<input>")
			),
			$("<label>").text("URL:").append(
				$url = $("<input>")
			),
			$("<p>").html(fmt.mdTextToHtml(help.join("\n")))
		);

		miaou.dialog({
			title: 'Insert Hyperlink',
			content: $c,
			buttons: {
				Cancel: null,
				Insert: insertLink
			},
			default: "Insert"
		});

		$text.focus();
		if (sel) {
			var linkMatch = sel.match(/^\s*\[([^\]]+)\]\(([^\)]+)\)\s*$/);
			if (linkMatch) {
				$text.val(linkMatch[1]);
				$url.val(linkMatch[2]);
			} else if (/^\s*(https?:\/\/\S+|\d+#\d+|u\/\w+)\s*$/i.test(sel)) {
				$url.val(sel);
			} else {
				$text.val(sel);
				$url.focus();
			}
		}
	}

});
