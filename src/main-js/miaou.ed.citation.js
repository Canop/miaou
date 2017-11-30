// citation related function of the miaou editor
miaou(function(ed){

	function toggleLinesCitation(s){
		return ed.toggleLines(s, /^>\s*/, '> ');
	}

	ed.onCtrlQ = function(){
		var	sp = this.selectionStart,
			ep = this.selectionEnd,
			val = this.value,
			$input = $(this);
		if (sp===ep && ed.stateBeforePaste) {
			// some citation was just pasted
			this.selectionStart = sp = ed.stateBeforePaste.selectionStart;
			if (sp<ep-1 && val[ep-1]==='\n') this.selectionEnd--;
		}
		if (sp===ep) {
			$input.selectLines().replaceSelection(toggleLinesCitation);
			this.selectionStart = this.selectionEnd;
		} else {
			$input.selectLines().replaceSelection(toggleLinesCitation);
		}
	}

});
