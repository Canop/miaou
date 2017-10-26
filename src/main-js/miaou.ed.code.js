// ed is the message editor, managing the user input
// ed.code handles code edition

miaou(function(ed){

	var langs = [
		'auto', 'bsh', 'c', 'cpp', 'cs', 'css', 'erlang', 'go', 'hs', 'html', 'java',
		'js', 'lisp', 'md', 'perl', 'python', 'r', 'sql', 'tcl', 'tex', 'xml',
	];

	function toggleLinesCode(s){
		return ed.toggleLines(s, /^( {4}|\t)/, '\t');
	}

	ed.code = {};

	ed.code.onCtrlK = function(){
		var	sbp = ed.stateBeforePaste,
			val = this.value,
			$input = $(this);
		$('#code-controls').remove();
		if (this.selectionStart===this.selectionEnd && sbp) {
			// some code was just pasted
			var pasted = val.slice(sbp.selectionEnd, this.selectionEnd);
			if (sbp.selectionEnd>0 && val[sbp.selectionEnd-1]!=='\n') {
				// the code wasn't inserted on a new line
				if (val[sbp.selectionEnd-1]===' ' && !~pasted.indexOf('\n') && pasted.length<50) {
					// it's some short code after a space, let's inline it
					$input.insertTextAtPos("`", this.selectionEnd);
					$input.insertTextAtPos("`", sbp.selectionEnd);
					return;
				}
				// let's add a new line
				$input.insertTextAtPos("\n", sbp.selectionEnd++);
			}
			this.selectionStart = sbp.selectionEnd;
			$input.selectLines().replaceSelection(toggleLinesCode);
			ed.code.onMove();
			return;
		}
		if (
			(
				this.selectionStart===this.selectionEnd
			) || (
				~val.slice(this.selectionStart, this.selectionEnd+1).indexOf('\n')
			) || (
				this.selectionEnd===val.length && this.selectionStart===this.selectionEnd
			) || (
				this.selectionEnd===val.length && (this.selectionStart===0||val[this.selectionEnd-1]==='\n')
			)
		) {
			$input.selectLines().replaceSelection(toggleLinesCode);
		} else {
			$input.replaceSelection(function(s){ return /^`[\s\S]*`$/.test(s) ? s.slice(1, -1) : '`'+s+'`' });
		}
		ed.code.onMove();
	}

	// returns true when it's code
	ed.code.onPasted = function(pasted){
		var looksLikeCode = /^<|^\$|}$|;$/m.test(pasted);
		if (!looksLikeCode) return;
		var notIndented = /^(?! {4}|\t)/m.test(pasted);
		if (notIndented) {
			$('<div id=code-controls>').appendTo('#input-panel').html(
				"This looks like code.<br>Hit ctrl-K to have it indented"
				+ " and properly rendered in Miaou"
			);
		}
		return true;
	}

	// analyse du code sous le curseur
	function BlockAnalysis(){
		var input = this.input = document.getElementById('input');
		this.linesBeforeCursor = input.value.slice(0, input.selectionEnd).split('\n');
		var nbLines = this.linesBeforeCursor.length;
		for (var nbLinesOfCode=0; /^( {4}|\t)/.test(this.linesBeforeCursor[nbLines-nbLinesOfCode-1]); nbLinesOfCode++);
		this.isCode = nbLinesOfCode>0;
		if (!this.isCode) return;
		this.nbLinesOfCode = nbLinesOfCode;
		this.selectedLang = 'auto';
		this.langPragmaLine = -1; // index line
		if (nbLines>nbLinesOfCode) {
			var	i = nbLines-nbLinesOfCode-1,
				langMatch = this.linesBeforeCursor[i].match(/^\s*#lang-(\w+)\s*$/);
			if (langMatch) {
				this.selectedLang = langMatch[1];
				this.langPragmaLine = i;
			}
		}
	}

	// show or hide the code controls, depending whether the cursor is over some code
	BlockAnalysis.prototype.showHideControls = function(){
		if (!this.isCode) {
			$('#code-controls').remove();
			return;
		}
		if ($('#code-controls').length) return;
		var $controls = $('<div id=code-controls>').appendTo('#input-panel');
		$('<span>').text("Language : ").appendTo($controls);
		for (var i=0; i<langs.length; i++) {
			var $lang =	$('<span>').text(langs[i]).addClass('lang').appendTo($controls);
			if (langs[i]===this.selectedLang) $lang.addClass('selected');
		}
	}

	BlockAnalysis.prototype.setLang = function(lang){
		if (lang===this.selectedLang) return;
		var	input = this.input,
			lines = input.value.split('\n');
		$('#code-controls .lang').filter(function(){
			return $(this).text()===lang
		})
		.addClass('selected')
		.siblings().removeClass('selected');
		if (lang==='auto') {
			if (this.langPragmaLine==-1) return
			lines.splice(this.langPragmaLine, 1);
		} else {
			var	pragma = '#lang-'+lang;
			if (this.langPragmaLine>=0) {
				lines[this.langPragmaLine] = pragma;
			} else {
				// lang pragma insertion
				lines.splice(this.linesBeforeCursor.length-this.nbLinesOfCode, 0, pragma);
				input.value = lines.join('\n')
			}
		}
		var oldLength = input.value.length;
		input.value = lines.join('\n');
		var ds = input.value.length - oldLength;
		input.selectionStart += ds;
		input.selectionEnd += ds;
		input.focus();
	}

	$('#input-panel').on('click', '.lang', function(){
		var lang = $(this).text();
		var ba = new BlockAnalysis();
		ba.setLang(lang);
	});

	ed.code.onMove = function(){
		var ba = new BlockAnalysis();
		ba.showHideControls();
	}

});
