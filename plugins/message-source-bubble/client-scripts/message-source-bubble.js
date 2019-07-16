// adds a bubble on the </> button

miaou(function(gui, fish, plugins){

	if (gui.mobile) return;

	function bindBubbles(){
		$("#messages, #notable-messages, #search-results").bubbleOn(".copysrc", {
			blower: function($c){
				let message = $(this).closest(".message").dat("message");
				if (!message || !message.content) return false;
				$c.addClass("message-source-bubble");
				$("<h3>").text("Message Source:").appendTo($c);
				$("<pre>").text(message.content||"").appendTo($c);
				$("<i>").text("click the icon to copy").appendTo($c);
			}
		});
	}

	plugins["message-source-bubble"] = {
		start: bindBubbles
	};

});


