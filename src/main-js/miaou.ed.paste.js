// handle pasting in the input
miaou(function(ed){

	var input = document.getElementById('input');
	if (!input) return;

	document.addEventListener('paste', function(e){
		console.log("pasta 1");
		ed.stateBeforePaste = {
			selectionStart:input.selectionStart, selectionEnd:input.selectionEnd, value:input.value
		};
		var initialText = input.value; // because I can't seem to be able to prevent paste
		var files = e.clipboardData.files;
		console.log("pasta 2", files);
		if (!files.length && e.clipboardData.items) {
			console.log("pasta 2.1", e.clipboardData.items);
			files = [].map.call(e.clipboardData.items, function(item){
				return item.getAsFile();
			}).filter(Boolean);
		}
		console.log("pasta 2.5", files);
		var	tbl,
			txt = e.clipboardData.getData('text/plain');
		console.log("pasta 3", txt.slice(0, 20));
		if (txt) {
			tbl = ed.tbl.textAsTable(txt);
		}
		for (var i=0; i<files.length; i++) {
			if (!files[i]) continue;
			if (/^image\//i.test(files[i].type)) {
				if (tbl) {
					ed.tbl.askAboutPastedTable(tbl, files[i], initialText);
				} else {
					ed.handleImageFile(files[i]);
				}
				return false;
			}
		}
		var pasted = txt;
		console.log("pasta 4");
		if (ed.code.onPasted(pasted)) return;
		console.log("pasta 5");
		if (tbl) {
			ed.tbl.askAboutPastedTable(tbl, null, initialText);
		}
		console.log("pasta 6");
	});

});
