// ed is the message editor, managing the user input

miaou(function(ed, chat, gui, locals, md, ms, notif, skin, usr, ws){

	var	$input, input,
		replyRegex = /@(\w[\w\-\.]{2,})#(\d+)\s*/, // the dot because of miaou.help
		stash, // save of the unsent message edition, if any
		editedMessage, 	// currently edited message, if any
				// (if you cycle through messages, their edited content
				// is saved in a property stash)
		savedValue, $autocompleter, editwzin, replywzin;

	ed.stateBeforePaste = null; // {selectionStart,selectionEnd,value}

	ed.toggleLines = function(s, r, insert){
		var	lines = s.split('\n'),
			on = lines.reduce(function(b, l){ return b && r.test(l) }, true);
		return lines.map(function(l){ return on ? l.replace(r, '') : insert+l }).join('\n');
	}

	function _send(txt){
		$input.val('');
		var m = {content: txt};
		if (editedMessage) {
			m.id = editedMessage.id;
			$('#cancelEdit').hide();
			$('#help').show();
			if (stash) $input.val(stash);
			ed.cancelEdit();
		}
		if ($autocompleter) $autocompleter.remove();
		ed.cancelReply();
		stash = null;
		chat.sendMessage(m);
		$('#preview').html('');
		if (!gui.mobile) $input.focus();
	}

	function sendInput(){
		notif.userAct();
		var txt = $input.val().replace(/\s+$/, '');
		if (txt.length > chat.config.maxMessageContentSize) {
			miaou.dialog({
				title: "Message too big",
				content: "Messages can't be more than "+chat.config.maxMessageContentSize+
					" characters long.\nYour message is "+txt.length+" characters long."
			});
			return;
		}
		if (!txt.replace(replyRegex, '').length) return;
		if (/(^|\W)@room\b/.test(txt) && usr.nbRecentUsers()>9) {
			miaou.dialog({
				title: "@room ping",
				content: "Do you really want to ping every users of this room, even the not"+
					" connected ones ?",
				buttons: {
					"Yes":function(){ _send(txt) },
					"Change it to @here":function(){
						_send(txt.replace(/(^|\W)@room\b/g, '$1@here'))
					},
					"Wait. No!":null
				}
			});
			return;
		}
		_send(txt);

	}

	// returns the currently autocompletable typed name, if any
	function getacname(){
		var m = input.value.slice(0, input.selectionEnd).match(/(^|\W)@(\w\S*)$/);
		return m ? m[2].toLowerCase() : null;
	}
	// returns the currently autocompletable typed command, if any
	function getaccmd(){
		var m = input.value.slice(0, input.selectionEnd).match(/(^|\W)!!(\w+)$/);
		return m ? m[2].toLowerCase() : null;
	}

	function tryautocomplete(){
		if ($autocompleter) {
			$autocompleter.remove();
			$autocompleter = null;
		}
		// should we display the name autocompleting menu ?
		var acname = getacname();
		if (acname) {
			ed.proposepings(usr.recentNamesStartingWith(acname));
			return ws.emit('autocompleteping', acname);
		}
		// should we display the command autocompleting menu ?
		var accmd = getaccmd();
		if (accmd) {
			savedValue = input.value;
			$autocompleter = $('<div id=autocompleter/>').prependTo('#input-panel');
			Object.keys(chat.commands).filter(function(n){
				return !n.indexOf(accmd)
			}).sort().forEach(function(name){
				$('<span>').text(name).appendTo($autocompleter).click(function(){
					$input.replaceSelection(name.slice(accmd.length));
					$autocompleter.remove();
					$autocompleter = null;
				});
			});
		}
	}

	function tabautocomplete(){
		var	index = ($autocompleter.find('.selected').index()+1) % $autocompleter.find('span').length,
			name = $autocompleter.find('span').removeClass('selected').eq(index).addClass('selected').text(),
			accmd = getaccmd();
		if (accmd) {
			input.selectionStart = input.selectionEnd - accmd.length;
			$input.replaceSelection(name);
			input.selectionStart = input.selectionEnd;
		} else {
			ed.ping(name);
		}
	}

	function insertLink(){
		$input.replaceSelection(function(s){
			var url = $('#newlinkhref').val().replace(/\(/g, '%28').replace(/\)/g, '%29');
			return '['+s+']('+url+')';
		});
	}

	// dif : +1 or -1
	function editPreviousOrNext(dif){
		var index = -1;
		var	myMessages = md.getMessages().filter(function(m){
			ms.updateStatus(m);
			return m.status.editable;
		});
		if (editedMessage) {
			editedMessage.stash = input.value;
			for (var i=0; i<myMessages.length; i++) {
				if (editedMessage.id===myMessages[i].id) {
					index = i;
					break;
				}
			}
		}
		var indexBefore = index;
		if (~index) {
			index += dif;
			if (index<0) index = 0;
			if (index>=myMessages.length) index = -1;
		} else if (dif<0) {
			index = myMessages.length-1;
		}
		if (indexBefore === index) return;
		if (~index) ed.editMessage($('#messages .message[mid='+myMessages[index].id+']'));
		else ed.cancelEdit();
	}

	function replyPreviousOrNext(dif){
		var messages = md.getMessages().filter(function(m){
			return m.id && m.content && m.author !== locals.me.id && !(editedMessage && m.id>editedMessage.id);
		});
		var	index = -1,
			m = input.value.match(replyRegex);
		if (m) {
			var mid = +m[2];
			for (var i=0; i<messages.length; i++) {
				if (mid===messages[i].id) {
					index = i;
					break;
				}
			}
		}
		var indexBefore = index;
		if (~index) {
			index += dif;
			if (index>=messages.length) index = -1;
		} else if (m || dif>0) {
			return;
		} else {
			index = messages.length-1;
		}
		if (indexBefore === index) return;
		if (~index) ed.replyToMessage($('#messages .message[mid='+messages[index].id+']'));
		else ed.cancelReply();
	}

	// sets or unsets the reply wzin depending on the message
	// if a $message is passed, it's assumed it matches
	function updateReplyWzin($message){
		var m, mid;
		if ($message) {
			mid = +$message.attr('mid');
		} else {
			m = input.value.match(replyRegex);
			if (m) mid = +m[2];
		}
		if (replywzin) {
			if (mid && (replywzin.e1.attr('mid')==mid || replywzin.e2.attr('mid')==mid)) return;
			replywzin.remove();
			replywzin = null;
		}
		if (!$message && m) $message = $('#messages .message[mid='+m[2]+']');
		if ($message && $message.length) {
			var mtop = $message.offset().top, $scroller = gui.$messageScroller;
			if (mtop<0) {
				$scroller.scrollTop(mtop+$scroller.scrollTop()-25);
			} else if ($scroller.height()+$scroller.scrollTop()<$scroller[0].scrollHeight) {
				$scroller.scrollTop(Math.min(mtop+$scroller.scrollTop()-25, $scroller[0].scrollHeight));
			}
			replywzin = wzin($message, $('#input'), {
				zIndex:5, fill:skin.wzincolors.reply,
				scrollable:gui.$messageScroller, parent:document.body
			});
		}
	}

	function makeLink(){
		if (/^\s*https?:\/\/\S+\s*$/i.test($input.selectedText())) {
			alert("It's already an URL, you don't need to make it a link.");
			return;
		}
		miaou.dialog({
			title: 'Insert Hyperlink',
			content: 'URL : <input id=newlinkhref style="width:82%">',
			buttons: {
				Cancel: null,
				Insert: insertLink
			}
		});
		$('#newlinkhref').focus().on('keyup', function(e){
			switch (e.which) {
			case 13: // enter
				insertLink();
			case 27: // esc
				miaou.dialog.closeAll();
			}
		});
	}

	ed.init = function(){
		$input = $('#input');
		input = $input[0];
		$input.on('keydown', function(e){
			notif.userAct();
			if (miaou.dialog.has()) return false;
			if (e.ctrlKey && !e.shiftKey) {
				switch (e.which) {
				case 75: // ctrl - K : toggle code
					ed.code.onCtrlK.call(this);
					return false;
				case 81: // ctrl - Q : toggle citation
					ed.onCtrlQ.call(this);
					return false;
				case 76: // ctrl - L : make link
					makeLink();
					return false;
				case 66: // ctrl - B : toggle bold
					$input.replaceSelection(function(s){
						return /^\*\*[\s\S]*\*\*$/.test(s) ? s.slice(2, -2) : '**'+s+'**'
					});
					return false;
				case 73: // ctrl - I : toggle italic
					$input.replaceSelection(function(s){
						return /^\*[\s\S]*\*$/.test(s) ? s.slice(1, -1) : '*'+s+'*'
					});
					return false;
				case 13: // ctrl - enter : insert new line
					$input.replaceSelection(function(s){ return s+'\n' });
					return false;
				case 38: // ctrl - up arrow
					replyPreviousOrNext(-1);
					return false;
				case 40: // ctrl - down arrow
					replyPreviousOrNext(+1);
					return false;
				}
			} else if (e.altKey || e.shiftKey) {
				if (e.which===13) { // alt|shift - return
					$input.replaceSelection(function(s){ return s+'\n' });
					return false;
				}
			} else if (e.which===38) { // up arrow
				var isInFirstLine = $input.taliner().caretOnFirstLine;
				if (isInFirstLine || (editedMessage && input.selectionStart===input.value.length)) {
					editPreviousOrNext(-1);
					return false;
				}
			} else if (e.which===40) { // down arrow
				var isInLastLine = $input.taliner().caretOnLastLine;
				if (isInLastLine && editedMessage) {
					editPreviousOrNext(+1);
					return false;
				}
			} else if (e.which===27) { // esc
				if ($autocompleter && $autocompleter.length && input.value!=savedValue) {
					input.value = savedValue;
					tryautocomplete();
				} else if (replywzin) {
					gui.scrollToBottom();
					ed.cancelReply();
				} else {
					ed.cancelEdit();
				}
			} else if (e.which===13) { // enter
				if (gui.mobile) return;
				sendInput();
				return false;
			} else if (e.which===9) { // tab
				if ($autocompleter && $autocompleter.length) {
					tabautocomplete();
					return false;
				}
			}
		})
		.on('keyup', function(e){
			if (e.which===17) return; // ctrl-
			if (e.which===86 && e.ctrlKey) return; // end of ctrl-V
			ed.stateBeforePaste = null;
			ed.code.onMove();
			if (e.which===9) return false; // tab
		})
		.on('input', function(){
			tryautocomplete();
			if (!gui.mobile) updateReplyWzin();
		})
		.on('click', ed.code.onMove)
		.focus();

		$('#send').on('click', sendInput);

		$('#cancelEdit').on('click', ed.cancelEdit);
	}

	// adds or remove a ping to that username
	ed.ping = function(username){
		var	val = input.value,
			s = input.selectionStart,
			e = input.selectionEnd,
			r = new RegExp('\s?@'+username+'\\s*$', 'i'),
			acname = getacname();
		if (acname) {
			input.value = val.slice(0, e-acname.length) + username + val.slice(e);
			input.selectionStart = input.selectionEnd = e + username.length - acname.length;
		} else if (r.test(val)) {
			input.value = val.replace(r, '');
		} else {
			var insert = ' @'+username+' ';
			input.value = val.slice(0, e)+insert+val.slice(e);
			if (e==s) input.selectionStart += insert.length;
			input.selectionEnd = e + insert.length;
		}
		input.focus();
	}

	// toggle reply to an existing message
	ed.replyToMessage = function($message){
		var	message = $message.dat('message'),
			txt = input.value, m = txt.match(replyRegex),
			s = input.selectionStart, e = input.selectionEnd, l = txt.length, yetPresent = false;
		notif.userAct(message.id);
		if (m) {
			input.value = txt = txt.replace(replyRegex, '').replace(/^\s/, '');
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
		if (!gui.mobile) updateReplyWzin($message);
		ed.code.onMove();
	}

	// toggle edition of an existing message
	ed.editMessage = function($message){
		var message = $message.dat('message');
		if (editedMessage) {
			var edmid = editedMessage.id;
			this.cancelEdit();
			if (edmid===message.id) return;
		} else {
			stash = input.value;
		}
		editedMessage = message;
		$input.val(message.stash || message.content).focus();
		input.selectionStart = input.selectionEnd = input.value.length;
		$('#cancelEdit').show();
		$('#help').hide();
		if (!gui.mobile) {
			if (editwzin) editwzin.remove();
			editwzin = wzin($message, $('#input'), {
				zIndex:5, fill:skin.wzincolors.edit,
				scrollable:gui.$messageScroller, parent:document.body,
				changeElementBackground:true
			});
			updateReplyWzin();
		}
		ed.code.onMove();
	}

	// cancels replying
	ed.cancelReply = function(){
		$input.replaceInVal(replyRegex);
		if (replywzin) {
			replywzin.remove();
			replywzin = null;
		}
		ed.code.onMove();
	}

	// cancels edition
	ed.cancelEdit = function(){
		if (editedMessage) {
			input.value = stash||'';
			$('#cancelEdit').hide();
			$('#help').show();
			editedMessage = null;
			$input.focus();
			if (!gui.mobile) {
				editwzin.remove();
				editwzin = null;
				updateReplyWzin();
			}
			ed.code.onMove();
		}
	}

	// displays the list of autocomplete pings
	ed.proposepings = function(names){
		var	acname = getacname(),
			currentlySelectedName = $autocompleter ? $autocompleter.find('.selected').text() : null;
		savedValue = input.value;
		if (!acname || (names[0] && names[0].toLowerCase().indexOf(acname)!==0)) {
			return console.log('bad list'); // too late, probably
		}
		if (!/^!!\w/.test(savedValue)) {
			var indexMe = names.indexOf(locals.me.name);
			if (~indexMe) names.splice(indexMe, 1);
		}
		if (!'room'.lastIndexOf(acname, 0) && ( locals.room.private||usr.checkAuth('admin'))) {
			names.unshift('room');
		} else if (!'here'.lastIndexOf(acname, 0)) {
			names.unshift('here');
		}
		if (!names.length) return;
		if ($autocompleter) $autocompleter.remove();
		$autocompleter = $('<div id=autocompleter/>').prependTo('#input-panel');
		names.forEach(function(name){
			var $span = $('<span>').text(name).appendTo($autocompleter).click(function(){
				ed.ping(name);
				$autocompleter.remove();
				$autocompleter = null;
			});
			if (name===currentlySelectedName) $span.addClass('selected');
			if (name==='here'||name==='room') $span.addClass('special');
		});
	}
});
