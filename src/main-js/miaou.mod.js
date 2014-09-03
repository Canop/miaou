// moderation functions

miaou(function(mod, chat, md, ws){
	
	var durs = {};
	durs['d'] = 24 * (durs['h'] = 60 * (durs['m'] = 60));

	mod.dialog = function(user){
		var $c = $('<div>').addClass('ban-dialog'),
			durationtype;
		$('<span>').text("Duration :").appendTo($c);
		function radio(idval, text, $r){
			$c.append('<br>').append(
				$r = $('<input type=radio>').attr({id:idval, name:'duration-type', value:idval})
				.on('change', function(){
					durationtype = 
					$c.find('.custom').prop('disabled', !$('#custom').prop('checked'));
				})
			).append($('<label>').attr('for',idval).text(text));
			return $r;
		}
		radio('m10', '10 minutes').prop('checked', true);
		radio('m30', '30 minutes');
		radio('h2', '2 hours');
		radio('h12', '12 hours');
		radio('d2', '2 days');
		radio('custom', 'custom :');
		$('<input id=ban_nb class=custom type=number value=1 min=1>').prop('disabled', true).appendTo($c);		
		$('<select  id=ban_unit class=custom>')
		.append($('<option>').val('m').text('minutes'))
		.append($('<option>').val('h').text('hours'))
		.append($('<option>').val('d').text('days'))
		.prop('disabled', true).appendTo($c);		
		$('<p>').text("Reason :").appendTo($c);
		$('<input id=ban-reason>').appendTo($c);
		miaou.dialog({
			title: "Ban "+user.name,
			content: $c,
			buttons:{
				Cancel:null,
				Ban:function(){
					var ban = {banned:user.id, bannedname:user.name, reason:$('#ban-reason').val()},
						durationtype = $('input[name=duration-type]:checked').val(),
						m = durationtype.match(/^([a-z]+)(\d+)$/);
					if (m) {
						ban.nb = m[2];
						ban.unit = m[1];
					} else {
						ban.nb = $('#ban_nb').val();
						ban.unit = $('#ban_unit').val();
					}
					ban.duration = ban.nb*durs[ban.unit];					
					ws.emit('ban', ban);
				}
			}
		});
	}
	
	mod.showBan = function(ban){
		md.notificationMessage(function($c){
			// warning : parts of the ban object can be injected by another browser, don't use as html
			$('<p>').text(ban.bannedname+' was banned by '+ban.bannername+' for '+ban.nb+' '+ban.unit+'.').appendTo($c);
			if (ban.reason) $('<p>').text('Reason : '+ban.reason).appendTo($c);
		});
	}

});
