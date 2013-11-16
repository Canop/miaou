var miaou = miaou || {};
(function(){
	
	var dialogs = [];
	
	// opens a dialog
	// Properties of the options object :
	//  title (optional)
	//  content : html | dom object | jquery object
	//  buttons : map name->(func|null)
	//  cssClass (optional)
	miaou.dialog = function(options){
		var $d = $('<div class=dialog/>').hide().addClass(options.cssClass||'small');
		$d.append($('<div class=dialog_title/>').text(options.title||''));
		$d.append($('<div class=dialog_content/>').append(options.content));
		var $buttons = $('<div class=dialog_buttons/>').appendTo($d);
		var close = function(){
			$d.fadeOut(function(){$d.remove();});
		}
		$.each(options.buttons, function(name, func){
			$buttons.append($('<span>').addClass('button').html(name).click(function(){
				if (func()!==false) close();
			}));
		});
		$d.appendTo(document.body);
		var $mask = $('<div class=mask>').appendTo(document.body);
		$d = $d.add($mask).fadeIn();
		var d = {
			close: close, // removes the dialog
			hide: function(callback){ $d.fadeOut(callback) }, // just hides it so that it can be reopened (be careful not to let them accumulate)
			show: function(callback){ $d.fadeIn(callback) }, // shows a previously hidden dialog
			exists: function() { return !!$d.parent().length } // if false, it won't be possible to show it
		}
		dialogs.push(d);
		return d;
	}
	
	miaou.dialog.closeAll = function(){
		while (dialogs.length) dialogs.pop().close();
	}
	
})();

