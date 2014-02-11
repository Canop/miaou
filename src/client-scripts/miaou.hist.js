var miaou = miaou || {};

(function(){
	miaou.hist = {}
	
	$(function(){
		$('#hist').on('click', '[m]', function(){
			miaou.focusMessage(+$(this).attr('m'));
		}); 
	});
	
	miaou.hist.search = function(pattern) {
		miaou.socket.emit('hist', {}, function(res){
			//~ console.log(res);
			var records = res, d = records[0].d, n = records[records.length-1].d - d,
				$hist = $('#hist'), maxn = 0, logmaxn,
				$month, lastMonthString;
			records.forEach(function(r){
				maxn = Math.max(maxn, r.n);
			});
			if (n<0 || n>5000 || maxn==0) return console.log('invalid data', res);
			logmaxn = Math.log(maxn);
			$('#hist').empty();
			function day(d, n, m){
				var sm = moment(d*24*60*60*1000).format("MMM YYYY");
				if (sm != lastMonthString) {
					$month = $('<div>').addClass('month').append(
						$('<div>').addClass('label').text(sm)
					).appendTo($hist);
					lastMonthString = sm;
				}
				var $day = $('<div/>').addClass('day').append(
					$('<div/>').addClass('bb').css('width', Math.log(n)*80/logmaxn+'%')
				).appendTo($month);
				if (m) $day.attr('m',m);
			}
			records.forEach(function(r){
				for(d++;d<r.d;d++) day(d,0);
				day(d=r.d, r.n, r.m);
			});
			$('#hist').scrollTop($('#hist')[0].scrollHeight);
		});
	}
	
	miaou.hist.open = function(){
		$('#hist').show();
		miaou.hist.search();
	}

	miaou.hist.close = function(){
		$('#hist').hide();
	}

})();
