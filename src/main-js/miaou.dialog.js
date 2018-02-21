miaou(function(){

	var dialogs = [];

	// opens a dialog
	// Properties of the options object :
	//  title (optional)
	//  content : html | dom object | jquery object
	//  buttons : map name->(func|null)
	//  default : default button name (optional)
	//  cssClass (optional)
	miaou.dialog = function(options){
		miaou.prof.hide();
		var $d = $('<div class=dialog/>').addClass(options.cssClass||'small');
		$d.append($('<div class=dialog-title/>').text(options.title||''));
		$d.append($('<div class=dialog-content/>').append(options.content));
		var	buttons = options.buttons||{OK:null},
			$buttons = $('<div class=dialog-buttons/>').appendTo($d);
		var close = function(){
			dialogs.splice(dialogs.indexOf(d), 1);
			$d.fadeOut('fast', $.fn.remove.bind($d));
			$(window).off('keyup', handleKey);
		}
		var handleKey = function(e){
			if (e.which===13) {
				if (options.default) {
					if (buttons[options.default]()===false) return;
					close();
				}
				if (Object.keys(buttons).length===1) {
					close();
				}
			} else if (e.which===27) {
				close();
			}
		}
		$.each(buttons, function(name, func){
			var $button = $('<button>').html(name).click(function(){
				if (!(func && func()===false)) close();
			}).appendTo($buttons);
			if (name===options.default) $button.addClass("default-button");
		});
		$d.appendTo(document.body);
		var $mask = $('<div class=mask>').appendTo(document.body);
		$mask.click(miaou.dialog.closeAll);
		$d.click(function(e){
			e.stopPropagation();
		});
		$d = $mask.append($d);
		setTimeout(function(){
			$d.addClass("open");
		});
		var d = {
			close: close,
			hide: function(callback){
				$d.fadeOut(callback);
			},
			show: function(callback){
				$d.fadeIn(callback);
			},
			exists: function(){
				return !!$d.parent().length;
			}
		}
		setTimeout(function(){
			$(window).on('keyup', handleKey)
		}, 300); // this delay mostly to prevent the handling of the keydown event which lead to this dialog
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
