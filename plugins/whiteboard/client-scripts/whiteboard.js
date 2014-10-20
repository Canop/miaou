miaou(function(plugins, chat, md, ms){

	var r = /^\s*!!whiteboard(\s|$)/;

	plugins.whiteboard = {
		start: function(){
			ms.registerStatusModifier(function(message, status){
				if (r.test(message.content)) {
					status.editable = true;
				}
			});
			md.registerRenderer(function($c, m){
				if (r.test(m.content)) {
					$c.empty();
					$c.append(miaou.mdToHtml(m.content.replace(r,''), true, m.authorname));
					$c.closest('#messages .message').find('.user .decorations').prepend(
						$('<div>&#xe824;</div>').addClass('decoration')
					);
					m.whiteboard = true;
					return true;
				}
			});
			chat.on('sending_message', function(m){
				if (m.id) {
					var oldMessage = md.getMessage(m.id);
					if (oldMessage && oldMessage.whiteboard && oldMessage.author!==me.id) {
						// to avoid an error, let's silently restore the !!whiteboard if it's missing
						m.content = m.content.replace(/^(\s*!!\w*\s*)?/,'!!whiteboard ');
					}
				}
			});
		}
	}

});
