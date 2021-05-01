// adds bubble on inlined images

miaou(function(gui, fish, plugins){

	if (gui.mobile) return;

	// compute the optimal side for the bubble
	function bestSide(targetRect){
		let img = this;
		let iw = img.width();
		let ih = img.height();
		let ww = $(window).width();
		let wh = $(window).height();
		if (!(iw*ih*ww*wh>1)) return;
		let bestSide = "horizontal";
		let bestRatio = 0;
		function tryRatio(distToSide, imgdim, side){
			distToSide -= 30; // estimation of bubble margin + bubble arrow
			if (distToSide < 0) return;
			let ratio = distToSide / imgdim;
			if (ratio < bestRatio) return;
			bestRatio = ratio;
			bestSide = side;
		}
		tryRatio(targetRect.top, ih, "top");
		tryRatio(ww - targetRect.right, iw, "right");
		tryRatio(wh - targetRect.bottom, ih, "bottom");
		tryRatio(targetRect.left, iw, "left");
		return bestSide;
	}

	function bindBubbles(){
		$("#messages, #watches, #notable-messages, #search-results").bubbleOn(".content img", {
			side: bestSide,
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


