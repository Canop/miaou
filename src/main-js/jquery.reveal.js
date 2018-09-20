$.fn.scrollToShow = function($element){
	var	conTop = this.offset().top,
		conLeft = this.offset().left,
		elTop = $element.offset().top,
		elLeft = $element.offset().left,
		conHeight = this.height(),
		conWidth = this.width();
	if (
		elTop<conTop ||
		elTop>=conTop+conHeight ||
		elLeft<conLeft ||
		elLeft>=conLeft+conWidth
	) {
		this.animate({
			scrollLeft: elLeft-conLeft+this.scrollLeft(),
			scrollTop: elTop-conTop+this.scrollTop()
		}, 200);
	}
}

// ensures the element is in view by finding the first scrollable parent and scrolling it.
$.fn.reveal = function(){
	var $container = this;
	for (;;) {
		$container = $container.parent();
		var container = $container[0];
		if (!container) {
			break;
		}
		if (container.scrollHeight>container.clientHeight) {
			$container.scrollToShow(this);
			return;
		}
	}
	console.log("no scrollable parent");
}

