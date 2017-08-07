
// stuff related to images in chat

miaou(function(){

	// assuming the jquery collection contains images, registers
	//  a onload or onerror callback only if the image isn't already loaded
	//  and makes this callback removed once fired (to avoid retaining
	//  useless callbacks and closures)
	// Note: the test wiht naturalHeight is a workaround for a bug in
	//  Firefox which doesn't always set the complete boolean at the right
	//  time
	$.fn.imgOn = function(eventType, callback){
		this.each(function(){
			if (this.complete && this.naturalHeight) return;
			$(this).one(eventType, callback);
		});
		return this;
	};

});
