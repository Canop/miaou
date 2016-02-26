// handle table related functions of the edition
miaou(function(ed){

	ed.tbl = {};

	// return the passed string as a {rows:[]} object if it looks
	//  like a table
	// if almost all first "cells" are emtpy, it's probably indented code
	//  instead of a table
	ed.tbl.textAsTable = function(str){
		var lines = str.split('\n');
		if (lines.length<2) return;
		var	nbcols = 0,
			nbrows = 0,
			nbNotEmptyFirstCell = 0,
			rows = lines.map(function(l, i){
				var r = l.split('\t');
				nbNotEmptyFirstCell += /\S/.test(r[0]);
				nbcols = Math.max(nbcols, r.length);
				if (/\S/.test(l)) nbrows = i+1;
				return r;
			});
		if (nbcols>1 && nbNotEmptyFirstCell>1) return {rows:rows.slice(0, nbrows), nbcols:nbcols};
	}

	ed.tbl.tblAsMd = function(tbl){
		var	i,
			md = '\n';
		for (i=0; i<tbl.nbcols; i++) md += (tbl.rows[0][i]||' ')+'|';
		md += '\n';
		for (i=0; i<tbl.nbcols; i++) md += ':-:|';
		md += '\n';
		for (var j=1; j<tbl.rows.length; j++) {
			for (i=0; i<tbl.nbcols; i++) md += (tbl.rows[j][i]||' ')+'|';
			md += '\n';
		}
		return md;
	}

	ed.tbl.askAboutPastedTable = function(tbl, file, initialText){
		var $input = $('#input');
		var buttons = {
			"Paste it as text":function(){
				// default behavior, nothing to do
				$input.focus();
			},
			"Paste it as an editable table":function(){
				if (initialText !== undefined) $input.val(initialText);
				$input.replaceSelection(ed.tbl.tblAsMd(tbl));
				$input.focus();
			},
		};
		if (file) buttons["Paste it as an image"] = function(){
			if (initialText !== undefined) $input.val(initialText);
			ed.uploadFile(file);
		};
		miaou.dialog({
			title: "Table Pasting",
			content: "This looks like a table. What do you want to do with it?",
			buttons: buttons
		});
	}

	ed.tbl.onCtrlV = function(pasted, initialText){
		var tbl = ed.tbl.textAsTable(pasted);

		if (!tbl) return;
		ed.tbl.askAboutPastedTable(tbl, null, initialText);
	}

});
