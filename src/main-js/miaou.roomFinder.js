
// manages the lists of rooms for
// - /rooms
// - the desktop pad
miaou(function(roomFinder, locals, notif, time, watch, usr, ws){

	var	rooms = [],
		initialized = false,
		connected,
		hasPing,
		getWatch;

	var roomSets = {
		"Your Main Rooms": function(){
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
			return myRooms;
		},
		"Public Rooms": function(){
			return rooms.filter(function(r){ return !r.private });
		},
		"Private Rooms": function(){
			return rooms.filter(function(r){ return r.private && !r.dialog });
		},
		"Dialog Rooms": function(){
			return rooms.filter(function(r){ return r.dialog });
		},
	};

	function fetchRooms(callback){
		var pat = $("#room-search-input").val() || '';
		$("#room-search-reset").toggleClass("visible", !!pat);
		$.get('json/rooms?pattern='+encodeURIComponent(pat), function(data){
			if (pat!==($("#room-search-input").val()||'')) {
				console.log("received obsolete search result", pat);
				return;
			}
			rooms = data.rooms;
			updateRoomsTabsAndPage();
			if (callback) callback();
		});
	}

	function updateRoomsTabsAndPage(){
		$('#rooms-page').empty();
		var selectedSetIndex = $('.rooms-tabs .tab.selected').index();
		Object.keys(roomSets).forEach(function(name, i){
			var tabRooms = roomSets[name]();
			if (i===selectedSetIndex) showRooms(tabRooms);
			var nbunseen = tabRooms.reduce(function(sum, r){
				var w = getWatch(r.id);
				if (w) sum += w.nbunseen;
				return sum;
			}, 0);
			$(".rooms-tabs .tab .watch-count").eq(i).text(nbunseen||"")
			.toggleClass("has-unseen", !!nbunseen);
		});
	}

	function fillSquareTitle($roomHead, r){
		$("<div>").addClass("room-privacy").appendTo($roomHead);
		$('<a>').addClass("room-title").attr('href', r.path)
		.text(usr.interlocutor(r) || r.name)
		.appendTo($roomHead);
	}

	function fillSquareDescription($room, r){
		var	html = miaou.fmt.mdTextToHtml(r.description),
			$underDescription = $('<div>').addClass('under-room-description').appendTo($room);
		if (r.img) {
			$underDescription.css('background-image', 'url("'+r.img+'")');
		}
		$('<div>').addClass('room-description rendered').html(html).appendTo($underDescription);
	}

	function fillDialogSquareDescription($room, r){
		var $underDescription = $('<div>').addClass('under-room-description').appendTo($room);
		$underDescription.css('background-image', 'url("'+usr.avatarsrc(r)+'")');
	}

	roomFinder.$square = function(r){
		var $room = $("<div>").addClass("room");
		$room.addClass(r.lang).addClass(r.private?'private':'public');
		if (r.dialog) $room.addClass("dialog-square");
		var $roomHead = $("<div>").addClass("room-head").appendTo($room);
		fillSquareTitle($roomHead, r);
		if (r.avk) fillDialogSquareDescription($room, r);
		else fillSquareDescription($room, r);
		if (!r.dialog) {
			$("<div class=tag-set>").appendTo($room).append(r.tags.map(function(t){
				return $("<span class=tag>").text(t);
			}));
		}
		return $room;
	}

	function showRooms(rooms){
		$("#room-search-input").focus();
		var $container = $('#rooms-page').empty();
		if (!rooms.length) return;
		var $t = $('<div>').addClass('room-list');
		rooms.forEach(function(r){
			if (locals.room && r.id===locals.room.id) return;
			var	$room = roomFinder.$square(r),
				w = getWatch(r.id);
			if (w) {
				var $unseen = $('<span>').addClass('watch-count').text(w.nbunseen);
				var txt = "You're watching this room.";
				if (w.nbunseen) {
					$unseen.addClass('has-unseen');
					txt += " There's "+w.nbunseen+" new message";
					if (w.nbunseen>1) txt += "s";
					txt += ".";
				} else {
					txt += " There's no new message.";
				}
				if (hasPing(r.id)) {
					$unseen.addClass('has-ping');
					txt += " You were pinged here.";
				}
				$unseen.attr('title', txt).appendTo($room.find(".room-head"));
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
		hasPing = options.hasPing || notif.hasPing;
		connected = !!options.connected;
		if (!initialized) {
			$(".rooms-tabs").prepend(Object.keys(roomSets).map(function(name){
				return $("<span class=tab>").click(function(){
					$(this).addClass("selected").siblings().removeClass("selected");
					updateRoomsTabsAndPage();

				}).text(name).append("<span class=watch-count>");

			}));
			$(".rooms-tabs .tab").first().click();
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
		fetchRooms();
	}

});
