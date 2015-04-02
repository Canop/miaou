
// stuff related to images in chat

miaou(function(){

	// assuming the jquery collection contains images, registers
	//  a onload or onerror callback only if the image isn't already loaded
	//  and makes this callback removed once fired (to avoid retaining
	//  useless callbacks and closures)
	$.fn.imgOn = function(eventType, callback){
		this.each(function(){
			if (this.complete) return;
			$(this).one(eventType, callback);
		});
		return this;
	};

});
