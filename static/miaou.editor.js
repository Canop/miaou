// Handles the message editor
// fixme the $(textarea) function isn't cleanly wrapped as there are
//   relations to "send" and "cancel edit" buttons

// replace the selected part by what is returned by cb
$.fn.replaceSelection = function(cb){
	return this.each(function(i){		
		var v = this.value, s = this.selectionStart, e = this.selectionEnd, scrollTop = this.scrollTop;
		var toReplace = v.slice(s,e), replacement = cb.call(this, toReplace, v, s, e);
		this.value = v.slice(0, s) + replacement + v.slice(e);
		this.selectionEnd = e + replacement.length - toReplace.length;
		this.selectionStart = e-s ? s : this.selectionEnd;
      	this.focus();
	})
}

// changes the selection so that it covers entire line(s)
$.fn.selectLines = function(){
	return this.each(function(i,s){
		if (this.selectionStart>0 && this.value[this.selectionStart-1]!=='\n') {
			s = this.value.lastIndexOf('\n', this.selectionStart-1);
			this.selectionStart = Math.max(0, s+1);
		}
		if (this.selectionStart===this.selectionEnd) this.selectionEnd++;
		if (this.selectionEnd<this.value.length && this.value[this.selectionEnd-1]!='\n') {
			s = this.value.indexOf('\n', this.selectionEnd-1);
			this.selectionEnd = s===-1 ? this.value.length : s;
		}
		this.focus();
	})
}

// sets the textarea as an editor emitting on the provided socket
$.fn.editFor = function(socket){
	var $input = this, input = this[0];

	function sendInput(){
		var txt = $input.val().trim();
		if (txt.length){
			var m = {content: txt};
			var id = $input.data('edited-message-id');
			if (id) {
				m.id = id;
				$input.data('edited-message-id', null);
				$('#cancelEdit').hide();
			}
			socket.emit('message', m);
			$input.val('');
		}
	}
	
	function toggleLines(s,r,insert){
		var lines = s.split('\n');
		var on = lines.reduce(function(b,l){ return b && r.test(l) }, true);
		return lines.map(function(l){ return on ? l.replace(r,'') : insert+l }).join('\n');
	}
	function toggleLinesCode(s){
		return toggleLines(s, /^(    |\t)/, '\t');
	}
	function toggleLinesCitation(s){
		return toggleLines(s, /^>\s*/, '> ');
	}
	
	$input.on('keydown', function(e){
		if (e.ctrlKey && !e.shiftKey) {
			var sp = this.selectionStart, ep = this.selectionEnd, val = this.value;
			switch(e.which){
				case 75: // K : toggle code
				if (sp===ep) {
					this.value = toggleLinesCode(this.value);
				} else if (~val.slice(sp, ep).indexOf('\n')) {
					$input.selectLines().replaceSelection(toggleLinesCode);
				} else {
					$input.replaceSelection(function(s){ return /^`[\s\S]*`$/.test(s) ? s.slice(1, -1) : '`'+s+'`' });					
				}
				return false;
				case 81: // Q : toggle citation
				$input.selectLines().replaceSelection(toggleLinesCitation);
				return false;
				case 76: // L : select whole line(s)
				$input.selectLines();
				return false;
				case 66: // B : toggle bold
				$input.replaceSelection(function(s){ return /^\*\*[\s\S]*\*\*$/.test(s) ? s.slice(2, -2) : '**'+s+'**' });
				return false;
				case 73: // I : toggle italic
				$input.replaceSelection(function(s){ return /^\*[\s\S]*\*$/.test(s) ? s.slice(1, -1) : '*'+s+'*' });
				return false;
				case 13: // enter : insert new line
				$input.replaceSelection(function(s){ return s+'\n' });
				return false;
			}
		} else if (e.altKey || e.shiftKey) {
			if (e.which==13) {
				$input.replaceSelection(function(s){ return s+'\n' });
				return false;
			}
		} else if (e.which==27) { // esc
			$input.cancelEdit();
		} else if (e.which==13) { // enter
			sendInput();
			this.value = '';
			return false;
		}
	}).focus();
	$('#send').on('click', sendInput);
			
	$('#users').on('click', '.user', function(){
		var val = input.value, username = this.innerHTML;
		var r = new RegExp('\s?@'+username+'\\s*$');
		if (r.test(val)) {
			input.value = val.replace(r, '');
			$input.focus();
		} else {
			var insert = ' @'+username+' ', s = input.selectionStart, e = input.selectionEnd;
			input.value = val.slice(0,e)+insert+val.slice(e);
			if (e==s) input.selectionStart += insert.length;
			input.selectionEnd = e + insert.length;
			$input.focus();
		}
	});

	$('#cancelEdit').on('click', $.fn.cancelEdit.bind(this));
	return $input;
}

// toggle reply to an existing message
$.fn.replyToMessage = function(message){
	var input=this[0], txt = input.value, r = /@(\w[\w_\-\d]{2,})#(\d+)/, m = txt.match(r),
		s = input.selectionStart, e = input.selectionEnd, l = txt.length, yetPresent = false;
	if (m) {
		input.value = txt = txt.replace(r,'').replace(/^\s/,'');
		yetPresent = m[1]===message.authorname && m[2]==message.id;
	}
	if (!yetPresent) {
		if (!/^\s/.test(txt)) txt = ' '+txt;
		input.value = '@'+message.authorname+'#'+message.id+txt;
	}
	var dl = (input.value.length-l);
	input.selectionStart = s + dl;
	input.selectionEnd = e + dl;
	input.focus();
}

// toggle edition of an existing message
$.fn.editMessage = function(message){
	if (this.data('edited-message-id')==message.id) {
		this.cancelEdit();
		return;
	}
	this.data('edited-message-id', message.id);
	this.val(message.content).focus();
	var input = this[0];
	input.selectionStart = input.selectionEnd = input.value.length;
	$('#cancelEdit').show();
}

$.fn.cancelEdit = function(){
	if ($('#cancelEdit').is(':visible')) {
		this.val('');
		$('#cancelEdit').hide();
		this.data('edited-message-id', null);
	}
};
