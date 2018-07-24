// Support for message windows : dockable floating dialogs that
//   can display a message

miaou(function(win, chat, gui, md, ws){

	if (gui.mobile) return;

	var sides = ['left', 'bottom', 'right'];

	sides.forEach(function(side){
		$('<div/>').addClass('mwincontainer').addClass(side).appendTo(document.body);
	});

	chat.on('incoming_message', function(message){
		$('.mwintab').filter(function(){ return $(this).attr('mid')==message.id }).addClass('new');
		var $mwin = $('#mwin');
		if ($mwin.length && $mwin.attr('mid')==message.id) {
			$mwin.dat('message', message);
			md.render(
				$mwin.find('.content').empty().css('max-height', $(window).height()*.85),
				message
			);
		}
	});

	// called for the big central mwin only
	function closeMWin(){
		var $mwin = $('#mwin');
		if ($mwin.length) {
			var	$c = $mwin.find('.content'),
				m = $mwin.dat('message');
			if (m && $c.length)	md.unrender($c, m);
			$mwin.remove();
		}
	}

	// with no side, it goes to the middle
	win.add = function(message, side){
		closeMWin();
		$('.mwintab[mid='+message.id+']').remove();
		if (side) {
			var	line = (message.content||message.authorname).split("\n")[0],
				tokens = line.split(/\s+/),
				title = tokens[0], i=1;
			while (i<tokens.length && title.length+tokens[i].length<20) title += ' '+tokens[i++];
			$('.mwincontainer.'+side).append(
				$('<div/>').addClass('mwintab').html(miaou.fmt.mdTextToHtml(title))
				.attr('mid', message.id).click(function(){ win.add(message) })
			)
		} else {
			var $mc = $('<div/>').addClass('content');
			var $mwin = $('<div id=mwin/>').attr('mid', message.id).addClass('message').append($mc);
			$mwin.append($('<div class=remover/>').text('X').click(closeMWin)).appendTo(document.body);
			sides.forEach(function(side){
				$mwin.append($('<div/>').addClass('sider').addClass(side).click(function(){ win.add(message, side) }));
			});
			$mc.html('loading...'); // fixme : isn't replaced when the message isn't found on the server (hard deleted)
			ws.emit('get_message', message.id);
		}
	}

});
