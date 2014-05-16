(function(){

	// TODO show somewhere that a message is a whiteboard
	// TODO don't let the !!whiteboard be edited away
	// TODO hook also message sending to ensure there's still the !!whiteboard text (store here the id of the wb messages ?)

	var r = /^\s*!!whiteboard(\s|$)/;

	miaou.chat.plugins.whiteboard = {
		start: function(){
			miaou.ms.registerStatusModifier(function(message, status){
				if (!status.old && r.test(message.content)) {
					status.editable = true;
				}
			});
			miaou.md.registerRenderer(function($c, m){
				if (r.test(m.content)) {
					$c.append(miaou.mdToHtml(m.content.replace(r,''), true, m.authorname));
					return true;
				}
			});
		}
	}

})();
