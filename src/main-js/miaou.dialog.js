miaou(function(){
	
	var dialogs = [];
		
	// opens a dialog
	// Properties of the options object :
	//  title (optional)
	//  content : html | dom object | jquery object
	//  buttons : map name->(func|null)
	//  cssClass (optional)
	miaou.dialog = function(options){
		miaou.prof.hide();
		var $d = $('<div class=dialog/>').hide().addClass(options.cssClass||'small');
		$d.append($('<div class=dialog-title/>').text(options.title||''));
		$d.append($('<div class=dialog-content/>').append(options.content));
		var buttons = options.buttons||{OK:null},
			$buttons = $('<div class=dialog-buttons/>').appendTo($d);
		var close = function(){
			dialogs.splice(dialogs.indexOf(d), 1);
			$d.fadeOut('fast', function(){$d.remove();});
			$(window).off('keyup', handleKey);
		}
		var handleKey = function(e){
			if (e.which===27 || (e.which===13&&Object.keys(buttons).length===1)) close();
		}
		$.each(buttons, function(name, func){
			$buttons.append($('<button>').html(name).click(function(){
				if (!(func && func()===false)) close();
			}));
		});
		$d.appendTo(document.body);
		var $mask = $('<div class=mask>').appendTo(document.body);
		$d = $d.add($mask).hide().fadeIn('fast');
		var d = {
			close: close, // removes the dialog
			hide: function(callback){ $d.fadeOut(callback) }, // just hides it so that it can be reopened (be careful not to let them accumulate)
			show: function(callback){ $d.fadeIn(callback) }, // shows a previously hidden dialog
			exists: function() { return !!$d.parent().length } // if false, it won't be possible to show it
		}
		setTimeout(function(){ $(window).on('keyup', handleKey) }, 300); // this delay mostly to prevent the handling of the keydown event which lead to this dialog
		dialogs.push(d);
		return d;
	}
	
	// returns true if a dialog is currently open
	miaou.dialog.has = function(){
		return !!dialogs.length;
	}
	
	miaou.dialog.closeAll = function(){
		while (dialogs.length) dialogs.pop().close();
	}
	
});
