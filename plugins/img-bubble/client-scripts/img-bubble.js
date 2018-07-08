// adds bubble on inlined images

miaou(function(gui, fish, plugins){

	if (gui.mobile) return;

	function bindBubbles(){
		$("#messages, #watches, #notable-messages, #search-results").bubbleOn(".content img", {
			side: "horizontal",
			blower: function($c){
				var originalSrc = this.attr("src");
				var src = originalSrc.replace(
					/^(https:\/\/i\.imgur\.com\/\w+)[sbtm]\.(gif|png|jpe?g)$/,
					"$1.$2" // imgur small thumbnail to large one
				);
				$("<img>")
				.attr({src})
				.css({maxWidth:"65vw", maxHeight:"55vh"})
				.on("error", function(){
					this.src = originalSrc;
				})
				.on("load", function(){
					if (this.width==161 && this.height==81) {
						this.src = originalSrc;
					}
				})
				.appendTo($c);
			}
		});
	}

	plugins["img-bubble"] = {
		start: bindBubbles
	};

});


