
miaou(function(tagger, fmt, locals){

	// makes a tag set editable, with an autocompletion menu
	// TODO tab completion
	// TODO backspace to edit previous tag if input is empty
	// this is expected to wrap a .tag-set element
	$.fn.editTagSet = function(){
		this.hide();
		var	$field = this,
			tags = this.val().split(/\s+/g).filter(Boolean),
			$tagSet = $("<div>").addClass("tag-set edited").append(tags.map(function(t){
				return $("<span class=tag>").text(t);
			})).insertBefore(this),
			$input = $("<input>").appendTo($tagSet),
			lastPat,
			$menu = $("<div>").addClass("autocomplete-tags").hide().appendTo("body");
		$tagSet.on("click", ".tag", function(){
			this.remove();
			$field.val(alreadyPresentTags().join(" "));
		});
		function alreadyPresentTags(){
			return $tagSet.find(".tag").map(function(){
				return this.textContent;
			}).get();
		}
		function receiveMatches(matches){
			// matches are {name,description}
			if (
				matches.length &&
				!matches[0].name.toLowerCase().startsWith($input.val().toLowerCase()))
			{
				console.log("disregard obsolete completion", $input.val(), matches);
				return;
			}
			var apt = alreadyPresentTags();
			matches = matches.filter(function(t){
				return !~apt.indexOf(t.name);
			});
			$input.toggleClass("invalid", !matches.length);
			if (!matches.length) return $menu.hide();
			var offset = $tagSet.offset();
			$menu.css({
				position: "fixed",
				left: offset.left,
				top: offset.top + $tagSet.outerHeight(),
				width: $tagSet.width(),
				zIndex: 200 // TODO
			}).show().empty().append(matches.map(function(match){
				return $("<div class=autocomplete-tag>").append(
					$("<div class=tag>").text(match.name),
					$("<div class=tag-description>").text(match.description)
				);
			}));
		}
		function select(s){
			if (s) {
				$("<span class=tag>").text(s).insertBefore($input);
				$field.val(alreadyPresentTags().join(" "));
			}
			lastPat = "";
			$input.val(lastPat).focus();
		}
		function moveSelect(d){ // d: 1 or -1
			var	$items = $menu.find(".autocomplete-tag"),
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
			select($(this).find(".tag").text());
		}); // click comes after the blur, hence mousedown
		$input
		.on('keydown', function(e){
			if ($menu.is(":visible")) {
				var pat = $input.val();
				if (e.which==38||e.which==37) { // up/left arrow
					moveSelect(-1);
				} else if (e.which==40||e.which==39) { //down/right arrow
					moveSelect(1);
				} else if (e.which==27) { // escape
					$menu.hide();
					// revert to pre-enter state ?
				} else if (e.which==13) { // enter
					var s = $menu.find(".selected .tag").text();
					if (s) select(s);
					$menu.hide();
				} else if (pat && (e.which==32||e.which==9||e.which==13)) { // space/tab/enter
					$.get('json/tags?pattern='+encodeURIComponent(pat), function(matches){
						var val = $input.val().trim();
						for (var i=0; i<matches.length; i++) {
							if (val==matches[i].name) {
								select(val);
								$input.val("");
								$menu.hide();
								return;
							}
						}
					});
				} else {
					return;
				}
				return false;
			}
		})
		.on('keyup', function(e){
			var pat = this.value.trim();
			if (pat===lastPat) return;
			if (pat) {
				$.get('json/tags?pattern='+encodeURIComponent(pat), receiveMatches);
			} else {
				$menu.hide();
			}
			if (e.which==13) return false;
			lastPat = pat;
		})
		.on('blur', function(){
			$menu.hide();
		});
		return this;
	}

	tagger.blower = function($c){
		if (this.closest(".prettyprint").length) return false; // it's a prettyprint .tag...
		$c.text("loading...");
		$.get("json/tag?name="+encodeURIComponent(this.text()), function(data){
			if (!data.tag) {
				$c.text("Unknown Tag");
				return;
			}
			$c.addClass("text").html(fmt.mdTextToHtml(data.tag.description));
		});
	}

	// display tag description in bubbles when hovering tags
	$("#messages, body.home").bubbleOn(".tag", {
		blower: tagger.blower,
		classes: "tag-bubble",
	});
	$("#room-tags").bubbleOn(".tag", {
		blower: tagger.blower,
		classes: "tag-bubble",
		side: "left"
	});
});
