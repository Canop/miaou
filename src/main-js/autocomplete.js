
;$.fn.autocomplete = function(completer){
	this.each(function(){
		var	$field = $(this),
			lastPat,
			$menu = $("<div>").addClass("autocomplete-menu").hide().appendTo("body");
		function receiveMatches(matches){
			if (
				matches.length &&
				!matches[0].toLowerCase().startsWith($field.val().toLowerCase()))
			{
				console.log("disregard obsolete completion", $field.val(), matches);
				return;
			}
			if (!matches.length) return $menu.hide();
			var offset = $field.offset();
			$menu.css({
				position: "fixed",
				left: offset.left,
				top: offset.top + $field.outerHeight(),
				width: $field.width()
			}).show().empty().append(matches.map(function(match){
				return $("<div>").text(match);
			}));
		}
		function select(s){
			lastPat = s;
			$field.val(lastPat);
		}
		function moveSelect(d){ // d: 1 or -1
			var	$items = $menu.find("div"),
				$selected = $menu.find(".selected"),
				n = $items.length,
				index;
			if (!$selected.length) {
				index = d>0 ? 0 : n-1;
			} else {
				index = ($selected.index()+d)%n;
			}
			$items.removeClass("selected");
			if (index>=0) $items.eq(index).addClass("selected");
		}
		$menu.on("mousedown", "div", function(){
			select(this.textContent);
		}); // click comes after the blur, hence mousedown
		$field
		.on('keydown', function(e){
			if ($menu.is(":visible")) {
				if (e.which==38) { // up arrow
					moveSelect(-1);
				} else if (e.which==40) { //down arrow
					moveSelect(1);
				} else if (e.which==27) { // escape
					$menu.hide();
					// revert to pre-enter state ?
				} else if (e.which==13) { // enter
					var s = $menu.find(".selected").text();
					if (s) select(s);
					$menu.hide();
				} else {
					return;
				}
				return false;
			}
		})
		.on('keyup', function(e){
			var pat = this.value.trim();
			if (pat===lastPat) return;
			if (pat) completer(this.value, receiveMatches);
			else $menu.hide();
			lastPat = pat;
		})
		.on('blur', function(){
			$menu.hide();
		});
	});
};
