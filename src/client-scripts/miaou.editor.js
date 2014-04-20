// Handles the message editor

var miaou = miaou || {};
miaou.editor = (function(){
	
	var $input, input, stash, editedMessage, $pingmatcher;

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

	function sendInput(){
		var txt = $input.val().replace(/\s+$/,'');
		if (txt.length){
			$input.val('');
			var m = {content: txt};
			if (editedMessage) {
				m.id = editedMessage.id;
				editedMessage = null;
				$('#cancelEdit').hide();
				$('#help').show();
				if (stash) $input.val(stash);
			}
			stash = null;
			miaou.socket.emit('message', m);
			$('#preview').html('');
			if (!$(document.body).hasClass('mobile')) $input.focus();
		}
		$input.removeClass('edition');
	}
	
	// returns the currently autocompletable typed name, if any
	function getacname(){
		var m = input.value.slice(0, this.selectionEnd).match(/(^|\W)@(\w\S*)$/);
		return m ? m[2].toLowerCase() : null;
	}
	
	return {
		// prepare #input to emit on the provided socket
		init: function(){
			$input = $('#input');
			input = $input[0];
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
				} else if (e.which==38) { // up arrow
					var firstLineEnd = this.value.indexOf('\n'),
						isInFirstLine = firstLineEnd===-1 || firstLineEnd>=input.selectionStart;
					if (isInFirstLine && !editedMessage) {
						for (var messages=miaou.md.getMessages(), i=messages.length; i-->0;) {
							if (messages[i].author == me.id) {
								if (Date.now()/1000-messages[i].created < miaou.chat.MAX_AGE_FOR_EDIT) {
									stash = input.value;
									miaou.editor.editMessage(messages[i]);
									return false;
								}
								break;
							}
						}
					}
				} else if (e.which==40) { // down arrow
					var lastLineStart = this.value.lastIndexOf('\n'),
						isInLastLine = lastLineStart===-1 || lastLineStart<input.selectionStart;
					if (isInLastLine && editedMessage && editedMessage.content == $input.val()) {
						miaou.editor.cancelEdit();
						$input.val(stash);
						stash = null;
						return false;
					}
				} else if (e.which==27) { // esc
					miaou.editor.cancelEdit();
				} else if (e.which==13) { // enter
					sendInput();
					return false;
				} else if (e.which==9) { // tab
					if ($pingmatcher && $pingmatcher.length) {
						miaou.editor.ping($pingmatcher.find('span').removeClass('selected').eq(
							($pingmatcher.find('.selected').index()+1) % $pingmatcher.find('span').length
						).addClass('selected').text());
						return false;
					}
				}
			}).on('keyup', function(e){
				if (e.which===9) return false;
				if ($pingmatcher) {
					$pingmatcher.remove();
					$pingmatcher = null;
				}
				var acname = getacname();
				if (acname) miaou.socket.emit('autocompleteping', acname);
			}).focus();
			
			$('#send').on('click', sendInput);
					
			$('#cancelEdit').on('click', miaou.editor.cancelEdit);
			
			$('#uploadSend').click(function(){		
				var file = document.getElementById('file').files[0];
				if (!file || !/^image\//.test(file.type)) {
					alert('not a valid image');
					return;
				}
				var fd = new FormData();
				fd.append("file", file);
				var xhr = new XMLHttpRequest();
				xhr.open("POST", "upload");
				function finish(){
					$('#uploadcontrols,#inputpanel').show();
					$('#uploadwait,#uploadpanel').hide();
				}
				xhr.onload = function() {
					var ans = JSON.parse(xhr.responseText);
					finish();
					if (ans.image && ans.image.link) $('#input').insertLine(ans.image.link);
					else alert("Hu? didn't exactly work, I think...");
				}
				xhr.onerror = function(e){
					console.log(e);
					alert("Something didn't work as expected :(");
					finish();
				}
				$('#uploadcontrols').hide();
				$('#uploadwait').show();			
				xhr.send(fd);
			});
		},
		// adds or remove a ping to that username
		ping: function(username){
			var val = input.value, s = input.selectionStart, e = input.selectionEnd;
			var acname = getacname();
			if (acname) {
				input.value = val.slice(0, e-acname.length) + username + val.slice(e);
				input.selectionStart = input.selectionEnd = e + username.length - acname.length;
			} else if (new RegExp('\s?@'+username+'\\s*$').test(val)) {
				input.value = val.replace(r, '');
			} else {
				var insert = ' @'+username+' ';
				input.value = val.slice(0,e)+insert+val.slice(e);
				if (e==s) input.selectionStart += insert.length;
				input.selectionEnd = e + insert.length;
			}
			input.focus();		
		}, 
		// toggle reply to an existing message
		replyToMessage: function(message){
			var txt = input.value, r = /@(\w[\w_\-\d]{2,})#(\d+)/, m = txt.match(r),
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
		},
		// toggle edition of an existing message
		editMessage: function(message){
			if (editedMessage && editedMessage.id===message.id){
				this.cancelEdit();
				return;
			}
			editedMessage = message;
			$input.addClass('edition').val(message.content).focus();
			input.selectionStart = input.selectionEnd = input.value.length;
			$('#cancelEdit').show();
			$('#help').hide();
		},
		// cancels edition
		cancelEdit: function(){
			if (editedMessage) {
				input.value = stash||'';
				$('#cancelEdit').hide();
				$('#help').show();
				editedMessage = null;
				$input.removeClass('edition').focus();
			}
		},
		// receives list of pings
		proposepings: function(names){
			var acname = getacname();
			if (!acname || names[0].toLowerCase().indexOf(acname)!==0) return console.log('bad list'); // too late, probably
			$pingmatcher = $('<div id=pingmatcher/>').prependTo('#inputpanel');
			names.forEach(function(name){
				$('<span>').text(name).appendTo($pingmatcher).click(function(){
					miaou.editor.ping(name);
					$pingmatcher.remove();
					$pingmatcher = null;
				});
			});
			
		}
	}
})();
