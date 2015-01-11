miaou(function(md, plugins, ws){

	function render($c, m){
		if (!/^\s*!!survey\b/.test(m.content)) return;
		ws.emit('survey.votes', m.id);
		Groumf.replaceTextWithTextInHTML($c[0], /^\s*(@\w[\w\-]{2,}#?\d*\s+)?!!survey\b/, '');
		var $list = $c.find('ul,ol');
		var $table = $('<table class=survey-table>').insertBefore($list);
		$list.find('li').each(function(i){
			var	surveyid = 'survey_'+m.id,
				itemid = surveyid+'_'+i;
			$('<tr>').appendTo($table)
			.append(
				$('<td>').append('<input class=survey-cb disabled type=checkbox name='+surveyid+' id='+itemid+'>')
				.append($('<label for='+itemid+'>').html(this.innerHTML))
			)
			.append('<td class=nb-votes>')
			.append('<td class=pc-votes>')
		});
		$list.remove();
		return true;
	}

	// this is called on initial rendering and when other users vote
	function onreceivevotes(data){
		$('.message[mid='+data.mid+']').each(function(){
			var $table = $('.survey-table', this),
				$inputs = $table.find('input'),
				sum = 0;
			for (var key in data.votes) {
				sum += data.votes[key];
			}
			$inputs.prop('disabled', false);
			$table.find('tr').each(function(i){
				var votes = data.votes[i]||0, pc = Math.round(100*votes/sum)||0;
				$('.nb-votes', this).text(votes);
				$('.pc-votes', this).html('<i>'+pc+'%</i>').css("box-shadow", "inset "+pc+"px 0 0 0 rgba(182,105,57,0.4)");
			});
			if (data.vote==+data.vote) { // undefined=unknown_vote, -1=no_vote
				$inputs.prop('checked', false);
				if (data.vote>=0) $inputs.eq(data.vote).prop('checked', true);
			}
		});
	}

	$(document.body).on('change', '.survey-cb', function(){
		var cb = this, $cb = $(cb), mid = +$(this).closest('.message').attr('mid');
		if (this.checked) {
			var idx = $cb.closest('tr').index();
			$cb.closest('table').find('.survey-cb').filter(function(){ return this!==cb }).prop('checked', false);
			ws.emit('survey.vote', {mid:mid, vote:idx});
		} else {
			ws.emit('survey.vote', {mid:mid, vote:-1});
		}
	});

	plugins.survey = {
		start: function(){
			md.registerRenderer(render, true);
			ws.on('survey.votes', onreceivevotes);
		}
	}

});
