
// manages the lists of rooms for
// - /rooms
// - the desktop pad
// - the mobile pad (not yet)
//

miaou(function(roomFinder, locals, time, watch, usr, ws){

	var	rooms = [],
		initialized = false,
		connected, // if true we may
		descImageRegex = /^<img[^>]*><br>/,
		getWatch;

	function fetchRooms(callback){
		var pat = $("#room-search-input").val() || '';
		$("#room-search-reset").toggleClass("visible", !!pat);
		$.get('json/rooms?pattern='+encodeURIComponent(pat), function(data){
			if (pat!==($("#room-search-input").val()||'')) {
				console.log("received obsolete search result", pat);
				return;
			}
			rooms = data.rooms;
			updateRoomsTab();
			if (callback) callback();
		});
	}

	function updateRoomsTab(){
		var i = $('.rooms-tabs .tab.selected').index();
		$('#rooms-page').empty();
		if (!rooms.length) return;
		switch (i) {
		case 0:
			var myRooms = rooms.filter(function(r){
				return (r.hasself || r.auth) && !r.dialog
			});
			if (myRooms.length<5 && locals.welcomeRooms) {
				var roomIds = myRooms.reduce(function(s, r){
					return s.add(r.id);
				}, new Set);
				for (var j=0; j<locals.welcomeRooms.length; j++) {
					var room = locals.welcomeRooms[j];
					if (!roomIds.has(room.id)) myRooms.unshift(room);
				}
			}
			showRooms(
				myRooms,
				"You didn't participate in any non dialog room."
			);
			break;
		case 1:
			showRooms(
				rooms.filter(function(r){ return !r.private }),
				"There doesn't seem to be any public room on this server."
			);
			break;
		case 2:
			showRooms(
				rooms.filter(function(r){ return r.private && !r.dialog }),
				"There doesn't seem to be any public room on this server."
			);
			break;
		case 3:
			showRooms(
				rooms.filter(function(r){ return r.dialog }),
				"Dialog rooms are created by sending a Private Message to another user. You have none for now."
			);
			break;
		}
	}

	function fillSquareTitle($roomHead, r){
		$("<div>").addClass("room-privacy").appendTo($roomHead);
		$('<a>').addClass("room-title").attr('href', r.path)
		.text(usr.interlocutor(r) || r.name)
		.appendTo($roomHead);
	}

	function fillSquareDescription($room, r){
		var	html = miaou.fmt.mdTextToHtml(r.description),
			floatImage = descImageRegex.test(html);
		if (floatImage) html = html.replace(/<br>/, '');
		var $underDescription = $('<div>').addClass('under-room-description')
		.appendTo($room);
		var $description = $('<div>').addClass('room-description rendered').html(html)
		.appendTo($underDescription);
		if (floatImage) {
			var bgsrc = $description.find('img:eq(0)').remove().attr('src');
			$underDescription.css('background-image', 'url("'+bgsrc+'")');
		}
	}

	function fillDialogSquareDescription($room, r){
		var $underDescription = $('<div>').addClass('under-room-description').appendTo($room);
		//var $description = $('<div>').addClass('room-description rendered').appendTo($underDescription);
		$underDescription.css('background-image', 'url("'+usr.avatarsrc(r)+'")');
	}

	function showRooms(rooms, alt){
		$("#room-search-input").focus();
		var $container = $('#rooms-page').empty();
		if (rooms.length) {
			var $t = $('<div>').addClass('room-list');
			rooms.forEach(function(r){
				if (locals.room && r.id===locals.room.id) return;
				var $room = $("<div>").addClass("room");
				$room.addClass(r.lang).addClass(r.private?'private':'public');
				if (r.dialog) $room.addClass("dialog-square");
				var $roomHead = $("<div>").addClass("room-head").appendTo($room);
				fillSquareTitle($roomHead, r);
				if (r.avk) fillDialogSquareDescription($room, r);
				else fillSquareDescription($room, r);
				var w = getWatch(r.id);
				if (w) {
					var $unseen = $('<span>').addClass('watch-count').text(w.nbunseen);
					var txt = "You're watching this room.";
					if (w.nbunseen) {
						$unseen.addClass('has-unseen');
						txt += " There's "+w.nbunseen+" new message";
						if (w.nbunseen>1) txt += "s";
						txt += ".";
						//if (hasPings(r.id)) {
						//	$unseen.addClass('has-ping');
						//	txt += " You were also pinged here.";
						//}
					} else {
						txt += " There's no new message.";
					}
					$unseen.attr('title', txt).appendTo($roomHead);
				}
				if (connected) {
					var $hover = $("<div>").addClass("room-hover").appendTo($room);
					var $last = $('<div>').addClass('room-last-created').appendTo($hover);
					if (r.lastcreated) {
						$last.html(time.formatRelativeTime(r.lastcreated))
					}
					var $buts = $('<div>').addClass("room-buttons").appendTo($hover);
					var iswatched = !!w;
					$('<button>').text(w ? 'unwatch' : 'watch').click(function(){
						if (iswatched) {
							ws.emit('unwat', r.id);
							$(this).text('watch');
						} else {
							ws.emit('wat', r.id);
							$(this).text('unwatch');
						}
						iswatched = !iswatched;
						return false;
					}).appendTo($buts);
					$("<button>").addClass("room-enter").text("enter").appendTo($buts);
				}
				$room.appendTo($t).click(function(){
					location = r.path;
				});
			});
			return $container.append($t);
		} else {
			return $container.append($('<p>').html(alt));
		}
	}


	function selectRoomsTab(i){
		$('.rooms-tabs .tab').removeClass('selected').eq(i).addClass('selected');
		updateRoomsTab();
	}

	function cssFitSquares(selector, minSize, pageWidth){
		var	nbSquares = Math.max(pageWidth/ minSize | 0, 2),
			squareSide = (((pageWidth-24) / nbSquares) - 3) | 0;
		return selector + '{'
		+ 'width:'+squareSide+'px !important;'
		+ 'height:'+squareSide+'px !important;'
		+ '} ';
	}

	roomFinder.open = function(callback, options){
		options = options || {connected:true};
		getWatch = options.getWatch || watch.watch;
		selectRoomsTab(0);
		fetchRooms();
		connected = !!options.connected;
		if (!initialized) {
			$('.rooms-tabs .tab').click(function(){
				selectRoomsTab($(this).index());
			});
			$("#room-search-input").keyup(function(e){
				if (e.which===27) { // esc
					this.value = '';
				}
				fetchRooms(callback);
			});
			$("#room-search-reset").click(function(){
				$("#room-search-input").val('');
				fetchRooms(callback);
			});
			var	pageWidth = $('#rooms-page').innerWidth() - 3;
			if (pageWidth>100) {
				var style = document.createElement('style');
				style.type = 'text/css';
				style.innerHTML = cssFitSquares('.room', 175, pageWidth)
				+ cssFitSquares('.room.dialog-square', 130, pageWidth);
				$('head').append(style);
			}
			initialized = true;
		}
	}
	
});
