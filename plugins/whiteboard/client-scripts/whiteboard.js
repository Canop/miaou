miaou(function(plugins, chat, locals, md, ms){

	var r = /^\s*(@\w[\w\-]{2,}#?\d*\s+)?!!whiteboard\b/;

	plugins.whiteboard = {
		start: function(){
			ms.registerStatusModifier(function(message, status){
				if (r.test(message.content)) {
					status.editable = true;
				}
			});
			md.registerRenderer(function($c, m){
				if (r.test(m.content)) {
					Groumf.replaceTextWithTextInHTML($c[0], r, '');
					$c.closest('#messages .message').find('.decorations').prepend(
						$('<div>&#xe824;</div>').addClass('decoration')
					);
					m.whiteboard = true;
				}
			}, true);
			chat.on('sending_message', function(m){
				if (m.id) {
					var oldMessage = md.getMessage(m.id);
					if (oldMessage && oldMessage.whiteboard && oldMessage.author!==locals.me.id) {
						if (!r.test(m.content)) {
							// to avoid an error, let's silently restore the !!whiteboard if it's missing
							m.content = m.content.replace(/^(@[\w-]{3,}#?\d*\s+)?/,'$1!!whiteboard ');
						}
					}
				}
			});
		}
	}

});
