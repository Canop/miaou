// histogram and search functions

var miaou = miaou || {};

(function(mh){
	
	var currentPattern; // as the xhr-pulling flavour of socket.io doesn't handle callbacks, we have to store the currently searched pattern
	
	$(function(){
		$('#hist').on('click', '[m]', function(){
			miaou.md.focusMessage(+($(this).attr('sm')||$(this).attr('m')));
		}).on('mouseenter', '[m]', function(){
			var sn = +$(this).attr('sn'), d = +$(this).attr('d'),
				h = moment(d*24*60*60*1000).format('DD MMM');
			if (sn) h += '<br>' + sn + ' match';
			if (sn>1) h += 'es';
			$(this).append($('<div>').addClass('bubble').html(h));
		}).on('mouseleave', '[m]', function(){
			$('#hist .bubble').remove();
		});
	});

	mh.open = function(){
		$('#hist').show();
		miaou.hist.search($('#searchInput').val().trim());
	}

	mh.close = function(){
		$('#hist').hide();
	}
	
	mh.search = function(pattern) {
		if (!$('#hist').length) return;
		currentPattern = pattern;
		miaou.socket.emit('hist', {pattern:pattern});
	}
	
	mh.show = function(res){
		if (res.search.pattern !== currentPattern) {
			console.log('received histogram of another search', $('#searchInput').val().trim(), res);
			return;
		}
		var records = res.hist, d = records[0].d, n = records[records.length-1].d - d,
			$hist = $('#hist'), maxn = 0, logmaxn,
			$month, lastMonth;
		records.forEach(function(r){
			maxn = Math.max(maxn, r.n);
		});
		if (n<0 || n>5000 || maxn==0) return console.log('invalid data', res);
		logmaxn = Math.log(maxn);
		$('#hist').empty()[n>30?'removeClass':'addClass']('zoomed');
		function day(d, n, m, sn, sm){
			var month = moment(d*24*60*60*1000).format("MMM YYYY");
			if (month != lastMonth) {
				$month = $('<div>').addClass('month').append(
					$('<div>').addClass('label').text(month)
				).appendTo($hist);
				lastMonth = month;
			}
			var $bar = $('<div/>').addClass('bar').css('width', Math.log(n)*80/logmaxn+'%');
			if (sm) $bar.addClass('hit');
			var $day = $('<div/>').addClass('day').append($bar).attr('d',d).appendTo($month);
			if (m) $day.attr('m',m);
			if (sm) $day.attr('sm',sm).attr('sn',sn);
		}
		records.forEach(function(r){
			for(d++;d<r.d;d++) day(d,0);
			day(d=r.d, r.n, r.m, r.sn, r.sm);
		});
		$('#hist').scrollTop($('#hist')[0].scrollHeight);
		mh.showPage();
	}
	
	mh.clearSearch = function(){
		$('#hist .bar').removeClass('hit').removeAttr('sm sn');
	}

	mh.showPage = function(){
		if (!$('#hist').length) return;
		var $scroller = $('#messagescroller'), sh = $scroller.height();
		var $messages = $('#messages > .message').filter(function(){
			// this assumes #messages sticks to top of window
			var y = $(this).offset().top;
			return y<sh && y+$(this).height()>0;
		});
		if (!$messages.length) return;
		var fd = Math.floor($messages.first().data('message').created / (24*60*60)),
			ld = Math.floor($messages.last().data('message').created / (24*60*60));
		$('#hist .day').each(function(){
			var $this = $(this), d = +$(this).attr('d');
			$this[fd<=d && d<=ld ? 'addClass' : 'removeClass']('vis');
		});
	}

})(miaou.hist = {});
