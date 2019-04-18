// adds bubbles on external links

miaou(function(gui, fish, plugins){

	if (gui.mobile) return;

	const cache = new WeakMap; // link element -> content

	function blowWith($c, con){
		if (con.error) {
			console.log('error in external link preview building:', con.error);
			return false;
		}
		$c.addClass("external-link-preview");
		if (con.image) {
			$("<img>").attr("src", con.image).appendTo($c);
		}
		let $text = $("<div class=text>").appendTo($c);
		if (con.title) {
			$("<h2>").text(con.title).appendTo($text);
		}
		if (con.description) {
			$("<p>").addClass("description").text(con.description).appendTo($text);
		}
		if (con.site_name) {
			$("<i>").text(con.site_name).appendTo($text);
		}
	}

	function bindBubbles(){
		$("#messages, #watches, #notable-messages, #search-results").bubbleOn(
			".content a.external-link", function($c){
				let url = this.prop("href");
				let element = this[0];
				let con = cache.get(element);
				if (con) return blowWith($c, con);
				$.getJSON(
					"json/external-link-preview?url="+encodeURIComponent(url),
					function(con){
						cache.set(element, con);
						blowWith($c, con);
					}
				);
			}
		);
	}

	plugins["external-link-preview"] = {
		start: bindBubbles
	};

});


