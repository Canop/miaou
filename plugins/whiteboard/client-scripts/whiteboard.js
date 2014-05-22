(function(){

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
				console.log(r.test(m.content), m);
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
					console.log('oldMessage:',oldMessage);
					if (oldMessage && oldMessage.whiteboard && oldMessage.author!==me.id) {
						console.log('WB');
						// to avoid an error, let's silently restore the !!whiteboard if it's missing
						m.content = m.content.replace(/^(\s*!!\w*\s*)?/,'!!whiteboard ');
					}
				}
			});
		}
	}

})();
