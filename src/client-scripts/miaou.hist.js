var miaou = miaou || {};

(function(){
	miaou.hist = {}
	
	$(function(){
		$('#hist').on('click', '[m]', function(){
			miaou.focusMessage(+$(this).attr('m'));
		}); 
	});
	
	miaou.hist.search = function(pattern) {
		miaou.socket.emit('hist', {pattern:pattern}, function(res){
			//~ console.log(res);
			var records = res, d = records[0].d, n = records[records.length-1].d - d,
				$hist = $('#hist'), maxn = 0, logmaxn,
				$month, lastMonth;
			records.forEach(function(r){
				maxn = Math.max(maxn, r.n);
				//~ if (r.sm) console.log('found:',r);
			});
			if (n<0 || n>5000 || maxn==0) return console.log('invalid data', res);
			logmaxn = Math.log(maxn);
			$('#hist').empty();
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
				var $day = $('<div/>').addClass('day').append($bar).appendTo($month);
				if (m) $day.attr('m',sm||m);
			}
			records.forEach(function(r){
				for(d++;d<r.d;d++) day(d,0);
				day(d=r.d, r.n, r.m, r.sn, r.sm);
			});
			$('#hist').scrollTop($('#hist')[0].scrollHeight);
		});
	}
	
	miaou.hist.open = function(){
		$('#hist').show();
		miaou.hist.search($('#searchInput').val().trim());
	}

	miaou.hist.close = function(){
		$('#hist').hide();
	}

})();
