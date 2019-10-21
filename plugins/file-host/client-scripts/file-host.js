miaou(function(chat, ed, fmt, md, plugins){

	function renderList($c, $pragma){
		let $tbl = $c.find(".tablewrap").eq(0);
		let images = $tbl.find("tbody tr").map(function(){
			let $cells = $("td", this);
			return {
				id: $cells.eq(0).text(),
				src: $cells.eq(1).text(),
				size: $cells.eq(2).text()
			};
		}).get().filter(img => img.src && img.size);
		console.log('images:', images);
		if (images.length<1) return;
		$con = $("<div>").addClass("filehost-thumbs").insertBefore($tbl);
		$tbl.remove();
		images.forEach(img=>{
			$("<div class=filehost-thumb>").appendTo($con).append(
				$("<img>").attr("src", img.src),
				$("<span>").text(img.size)
			).click(function(){
				console.log("clicked:", img);
				chat.sendMessage(`!!!filehost info ${img.id}`);
				return false;
			});
		});
		$pragma.replaceWith($("<i>").text("Click an image for more information or to delete it"));
	}

	function renderDeleteButton($c, $pragma, fileId){
		$pragma.replaceWith(
			$("<button>").text("Delete File").click(function(){
				miaou.dialog.confirm(
					"Do you really want to delete this file ?",
					function(){
						chat.sendMessage(`!!filehost delete ${fileId}`);
					}
				);
				return false;
			})
		);
	}

	function renderMessage($c, m){
		let $pragma = $c.find(".pragma-filehost");
		if (!$pragma.length) return;
		let pragma = $pragma.text();
		console.log('pragma:', pragma);
		if (pragma == "#filehost-list") {
			return renderList($c, $pragma);
		}
		let match = pragma.match(/^#filehost-delete\((\d+)\)$/);
		if (match) {
			renderDeleteButton($c, $pragma, match[1]);
		}
	}

	plugins["file-host"] = {
		start: function(){
			fmt.whiteListPragma("filehost");
			md.registerRenderer(renderMessage, true);
			ed.registerCommandArgAutocompleter("filehost", [
				["list", "info", "delete"]
			]);
			// provide supplementarty autocompletion for the !!stats command
			ed.registerCommandArgAutocompleter("stats", [
				["file-host", ["global", "users", "types"]]
			]);
		}
	}

});

