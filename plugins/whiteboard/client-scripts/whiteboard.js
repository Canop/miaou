miaou(function(plugins, chat, md, ms){

	var r = /^\s*!!whiteboard\b/;

	function removeCommand(node){
		if (node.nodeType===3) {
			var result = node.nodeValue.replace(r, '');
			if (result !== node.nodeValue) {
				node.nodeValue = result;
				return true;
			}
		}
		for (var nodes=node.childNodes, i=0; i<nodes.length; i++) {
			if (removeCommand(node.childNodes[i])) return true;
		}
	}

	plugins.whiteboard = {
		start: function(){
			ms.registerStatusModifier(function(message, status){
				if (r.test(message.content)) {
					status.editable = true;
				}
			});
			md.registerRenderer(function($c, m){
				if (r.test(m.content)) {
					removeCommand($c[0]);
					$c.closest('#messages .message').find('.user .decorations').prepend(
						$('<div>&#xe824;</div>').addClass('decoration')
					);
					m.whiteboard = true;
				}
			}, true);
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
