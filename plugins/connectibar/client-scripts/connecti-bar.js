// adds bubble on inlined images

miaou(function(plugins){

	function showConnect(){
		$("#chat-connecting").addClass("connecti-bar").empty().append(
			"<div>", "<div>", "<div>"
		);
	}

	plugins["connectibar"] = {
		start: showConnect
	};

});


