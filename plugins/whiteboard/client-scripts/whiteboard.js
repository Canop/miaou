(function(){

	// TODO keep whiteboard icon on vote/pin
	// TODO hide "!!whiteboard" in notables messages

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
					$c.closest('#messages .message').addClass('whiteboard');
					m.whiteboard = true;
					return true;
				}
			});
			miaou.chat.on('sending_message', function(m){
				if (m.id) {
					var oldMessage = miaou.md.getMessage(m.id);
					if (oldMessage && oldMessage.whiteboard && oldMessage.author!==me.id) {
						// to avoid an error, let's silently restore the !!whiteboard if it's missing
						m.content = m.content.replace(/^(\s*!!\w*\s*)?/,'!!whiteboard ');
					}
				}
			});
		}
	}

})();
