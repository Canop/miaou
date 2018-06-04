// adds bubble on inlined images

miaou(function(fish, plugins){

	function bindBubbles(){
		$("#messages, #watches, #notable-messages, #search-results").bubbleOn(".content img", {
			side: "horizontal",
			blower: function($c){
				var src = this.attr("src")
				.replace(
					/^(https:\/\/i\.imgur\.com\/\w+)[sbtm]\.(gif|png|jpe?g)$/,
					"$1l.$2" // imgur small thumbnail to large one
				);
				$("<img>")
				.attr({src})
				.css({maxWidth:"65vw", maxHeight:"55vh"})
				.addClass("img-bubble")
				.appendTo($c);
			}
		});
	}

	plugins["img-bubble"] = {
		start: bindBubbles
	};

});


