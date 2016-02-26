miaou(function(attention, chat, locals, plugins, ws){

	function onNotable(m, $md){
		if (!m.pin) return;
		var $icon = $("<div>").addClass('attention-icon').text("!").appendTo($md);
		var admin = locals.room.auth==='admin'||locals.room.auth==='own';
		if (admin) $icon.addClass('attention-action');
		$icon
		.on('click', function(){
			return false;
		})
		.on('mouseenter', function(){
			var $menu = $("<div>").addClass("attention-menu").appendTo($icon);
			function menu(event, text, cb){
				$('<div>').addClass("attention-menu-article").appendTo($menu)
				.click(function(){
					console.log("emited attention."+event+" for", m.id);
					ws.emit('attention.'+event, m.id);
					if (cb) cb();
					return false;
				})
				.text(text);
			}
			if ($icon.hasClass('attention-alert')) {
				if ($icon.hasClass('attention-seen')) {
					$('<p>').text("Alert is acknowledged").appendTo($menu);
				} else {
					menu('ok', "Acknowledge the alert", function(){
						$icon.addClass('attention-seen');
					});
				}
				if (admin) {
					menu('remove', "Remove the alert for everybody", function(){
						if (admin) $icon.addClass('attention-action');
						$icon.removeClass('attention-alert');
					});
				}
			} else if (admin) {
				menu("alert", "Raise an alert for everybody");
			}
		})
		.on('mouseleave', function(){
			$('.attention-menu').remove();
		});
		setTimeout(function(){
			ws.emit('attention.query', m.id);
		}, 2000);
	}

	function onAlert(alert){
		var $icon = $('#notable-messages .message[mid='+alert.message+'] .attention-icon');
		$icon.removeClass('attention-action').addClass('attention-alert').dat('attention-alert', alert);
		if (alert.creator===locals.me.id) {
			$icon.addClass('attention-seen');
		}
		if (alert.seen) {
			$icon.addClass('attention-seen');
		}
	}

	function onRemove(mid){
		var $icon = $('#notable-messages .message[mid='+mid+'] .attention-icon');
		$icon.removeClass('attention-alert').removeClass('attention-seen');
	}

	plugins.attention = {
		start: function(){
			chat.on('notable', onNotable);
			ws.on('attention.alert', onAlert);
			ws.on('attention.remove', onRemove);
		}
	};
});
