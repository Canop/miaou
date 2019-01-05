// handle table related functions of the edition
miaou(function(ed){

	ed.tbl = {};

	// return the passed string as a {rows:[]} object if it looks
	//  like a table (with cell separator being the tab)
	// if almost all first "cells" are emtpy, it's probably indented code
	//  instead of a table
	ed.tbl.textAsTable = function(str){
		var lines = str.split('\n');
		if (lines.length<2) return;
		if (!/\t/.test(lines[0])) return;
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
		if (nbcols>1 && nbNotEmptyFirstCell>1) {
			return {
				rows: rows.slice(0, nbrows),
				nbcols: nbcols
			};
		}
	}

	// try to guess whether the first line is the column titles
	// sets the hasTitleRow bool property
	function hasTitleRow(tbl){
		for (var i=0; i<tbl.nbcols; i++) {
			var c = tbl.rows[0][i]||' ';
			if (/^[+-]?[\d\.,\s]+\w*$/.test(c) || !/^[\w\(\)\s-]{1,50}$/.test(c)) {
				return false;
			}
		}
		return true;
	}

	function rowAsMd(tbl, j){
		var md = "|";
		for (var i=0; i<tbl.nbcols; i++) md += (tbl.rows[j][i]||' ')+'|';
		return md + '\n';
	}

	ed.tbl.tblAsMd = function(tbl){
		var	i,
			j = 0,
			md = '\n';
		if (hasTitleRow(tbl)) md += rowAsMd(tbl, j++);
		for (i=0; i<tbl.nbcols; i++) md += ':-:|';
		md += '\n';
		while (j<tbl.rows.length) md += rowAsMd(tbl, j++);
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
