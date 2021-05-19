miaou(function(ed, fmt, md, locals, plugins, ws){

	plugins.pingme = {
		start: function(){
			ed.registerCommandArgAutocompleter("pingme", ["cancel", "list"]);
			fmt.whiteListPragma("pingme");
			md.registerRenderer(renderMessage, true);
		}
	}

	function renderMessage($c, m){
		let $pragma = $c.find(".pragma-pingme");
		if (!$pragma.length) return;
		let mat = m.content.match(/^\s*@([^#]+)#\d+ (.*)/); // first line
		if (!mat) return;
		let pinged = mat[1];
		let text = mat[2];
		let pragma = $pragma.text(); // should be pragma-repeat
		if (locals.me.name == pinged) {
			let repeat = pragma.match(/\(([^)]+)\)/)[1];
			let $span = $("<span>").text(repeat);
			$span.prepend(
				$("<button>").text("Repeat").click(function(){
					ws.emit("pingme.repeat", {
						mid: m.id,
						pingme: m.repliesTo,
						repeat,
						text
					});
					$(this).remove();
				})
			);
			$pragma.replaceWith($span);
		} else {
			$pragma.remove();
		}
	}
});

