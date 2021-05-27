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
		let mat = m.content.match(/^\s*@([^#]+)#(\d+) (.*)/); // first line
		if (!mat) return;
		console.log("m:", m);
		let pinged = mat[1];
		let pingme = mat[2];
		let text = mat[3];
		let pragma = $pragma.text(); // should be pragma-repeat
		if (locals.me.name == pinged) {
			let repeat = pragma.match(/\(([^)]+)\)/)[1];
			let $span = $("<span>").text(repeat);
			$span.prepend(
				$("<button>").text("Repeat").click(function(){
					console.log("pingme.repeat", {
						mid: m.id,
						pingme,
						repeat,
						text
					});
					ws.emit("pingme.repeat", {
						mid: m.id,
						pingme,
						repeat,
						text
					});
					$(this).remove();
					return false; // mostly useful when you click in a drawer
				})
			);
			$pragma.replaceWith($span);
		} else {
			$pragma.remove();
		}
	}
});

