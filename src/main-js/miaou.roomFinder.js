
// manages the lists of rooms for
// - /rooms
// - the desktop pad
// - the mobile pad (not yet)
//

miaou(function(roomFinder, locals, time, watch, ws){

	var	rooms = [],
		initialized = false,
		connected, // if true we may
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
		switch (i) {
		case 0:
			showRooms(
				rooms.filter(function(r){
					return (r.hasself || r.auth) && !r.dialog
				}),
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

	function showRooms(rooms, alt){
		$("#room-search-input").focus();
		var $container = $('#rooms-page').empty();
		if (rooms.length) {
			var $t = $('<div>').addClass('room-list'), rex = /^<img[^>]*><br>/;
			rooms.forEach(function(r){
				if (locals.room && r.id===locals.room.id) return;
				var $room = $("<div>").addClass("room").addClass(r.lang).addClass(r.private?'private':'public');
				var $roomHead = $("<div>").addClass("room-head").appendTo($room);
				$("<div>").addClass("room-privacy").appendTo($roomHead);
				// var $roomTitle = $("<div>").addClass("room-title").appendTo($roomHead);
				$('<a>').addClass("room-title").attr('href', r.path).text(r.name).appendTo($roomHead);
				var	html = miaou.fmt.mdTextToHtml(r.description),
					floatImage = rex.test(html);
				if (floatImage) html = html.replace(/<br>/, '');
				var $underDescription = $('<div>').addClass('under-room-description')
				.appendTo($room);
				var $description = $('<div>').addClass('room-description rendered').html(html)
				.appendTo($underDescription);
				if (floatImage) {
					var bgsrc = $description.find('img:eq(0)').remove().attr('src');
					$underDescription.css('background-image', 'url("'+bgsrc+'")');
				}
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
						$last.html('Last message: '+time.formatRelativeTime(r.lastcreated))
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

	roomFinder.open = function(callback, options){
		options = options || {connected:true};
		selectRoomsTab(0);
		fetchRooms();
		getWatch = options.getWatch || watch.watch;
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
			var	pageWidth = $('#rooms-page').width() - 3,
				nbSquares = Math.max(pageWidth / 175 | 0, 2),
				squareSide = ((pageWidth / nbSquares) - 4) | 0; // 2: square margin
			if (pageWidth>100) {
				var style = document.createElement('style');
				style.type = 'text/css';
				style.innerHTML = '.room {'
				+ 'width:'+squareSide+'px !important;'
				+ 'height:'+squareSide+'px !important;'
				+ '}';
				$('head').append(style);
			}
			initialized = true;
		}
	}
	
});
