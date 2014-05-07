// Support for message windows, that is dockable floating dialogs that
//   can display a message
// Defined selectors :
//   .mwincontainer
//   .left, .bottom
//   .mwintab
//   #mwin

var miaou = miaou || {};

(function(win){

	var sides = ['left', 'bottom', 'right', 'top'];

	$(function(){
		sides.forEach(function(side){
			$('<div/>').addClass('mwincontainer').addClass(side).appendTo(document.body);
		});
		miaou.chat.on('incoming_message', function(message){
			var $mwin = $('#mwin[mid='+message.id+']');
			if ($mwin.length) {
				$mwin.data('message', message);
				miaou.md.render(
					$mwin.find('.content').empty().css('max-height', $(window).height()*.7), // sadly didn't find a pure css solution
					message
				);
			}
		});
	});


	// side in "left", "top", etc.
	// with no side, it goes to the middle
	win.add = function(message, side){
		$('#mwin,.mwintab[mid='+message.id+']').remove();
		if (side) {

		} else {
			var $mc = $('<div/>').addClass('content');
			var $mwin = $('<div id=mwin/>').attr('mid',message.id).addClass('message').append($mc).appendTo(document.body);
			$mwin.append($('<div class=remover/>').text('X').click(function(){ $mwin.remove() }));
			$mc.html('loading...')
		}
		miaou.socket.emit('get_message', message.id);
	}



})(miaou.win = {});
