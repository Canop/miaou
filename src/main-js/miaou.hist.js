// histogram and search functions

miaou(function(hist, gui, md, time, ws){
	
	var	visible = false,
		currentPattern; // as the xhr-pulling flavour of socket.io doesn't handle callbacks, we have to store the currently searched pattern
	
	// arg : +1 or -1
	function moveSelect(d){
		var i, $s = $('#search-results .message.selected');
		if ($s.length) {
			i = $s.removeClass('selected').index() + d;
		} else {
			if (d<0) return;
			i = 0;
		}
		var $selected = $('#search-results .message').eq(i).addClass('selected');
		if ($selected.length) {
			md.focusMessage(+$selected.attr('mid'));
			var mtop = $selected.offset().top,
				$scroller = $('#right'), stop = $scroller.offset().top, sst = $scroller.scrollTop();
			if (mtop<stop+sst) {
				$scroller.scrollTop(mtop-stop+-25);
			} else if (mtop+$selected.height()+sst>stop+$scroller.height()) {
				$scroller.scrollTop(mtop+$selected.height()+sst-$scroller.height()+15);
			}			
		}
	}
	
	$('#hist').on('click', '[m]', function(){
		md.focusMessage(+($(this).attr('sm')||$(this).attr('m')));
	}).on('mouseenter', '[m]', function(){
		var	sn = +$(this).attr('sn'),
			n = +$(this).attr('n'),
			d = +$(this).attr('d'),
			h = time.formatDateDDMMM(new Date(d*24*60*60*1000));
		if (n) h += ' - ' + n + ' messages';
		if (sn) h += '<br>' + sn + ' match';
		if (sn>1) h += 'es';
		$(this).append($('<div>').addClass('bubble').html(h));
	}).on('mouseleave', '[m]', function(){
		$('#hist .bubble').remove();
	});

	if (gui.mobile) {
		$('#search').click(function(){
			var pat = $('#searchInput').val().trim();
			if (!pat) return;
			currentPattern = pat;
			hist.search(pat);
		});
	} else {
		$('#searchInput').on('keyup', function(e){
			if (e.which===27 && typeof tab === "function") { // esc
				tab("notablemessagespage"); // tab is defined in chat.jade
				$('#input').focus();
				return false;
			}
			if (e.which==38) { // up arrow
				moveSelect(-1);
			} else if (e.which==40) { //down arrow
				moveSelect(1);
			}
			var pat = this.value.trim();
			if (pat) {
				if (pat===currentPattern) return;
				hist.search(pat);
				hist.fetchHistogram(pat);
			} else {
				$('#search-results').empty();
				$('#hist .bar').removeClass('hit').removeAttr('sm sn');
			}
		});
	}

	hist.open = function(){
		visible = true;
		$('#hist').show();
		hist.fetchHistogram($('#searchInput').val().trim());
	}

	hist.close = function(){
		visible = false;
		$('#hist').hide();
	}

	// request the histogram (not the search result list)
	hist.fetchHistogram = function(pattern) {
		if (!visible) return;
		currentPattern = pattern;
		ws.emit('hist', {pattern:pattern});
	}

	// request the search result messages
	hist.search = function(pattern, page) {
		ws.emit('search', {pattern:pattern, page:page||0});
	}


	// receive search results sent by the server
	hist.found = function(res){
			if (res.search.pattern!=$('#searchInput').val().trim()) {
				console.log('received results of another search', $('#searchInput').val().trim(), res);
				return;
			}
			console.log('search results:', res);
			md.showMessages(res.results, $('#search-results'), res.search.page);
			if (res.mayHaveMore) {
					$('<div id=search-next-page>').text('more results')
					.click(function(){
						$(this).remove();
						hist.search(res.search.pattern, (res.search.page||0)+1);
					})
					.appendTo('#search-results');
			} else {
				$('#search-next-page').remove();
			}
	}
	
	// display search results histogram sent by the server
	hist.showHist = function(res){
		if (res.search.pattern !== currentPattern) {
			console.log('received histogram of another search', $('#searchInput').val().trim(), res);
			return;
		}
		$('#hist').empty();
		var records = res.hist;
		if (!records || !records.length) return;
		var	d = records[0].d, n = records[records.length-1].d - d,
			$hist = $('#hist'), maxn = 0, logmaxn,
			$month, lastMonth;
		$('#search-results .message.selected').removeClass('selected');
		records.forEach(function(r){
			maxn = Math.max(maxn, r.n);
		});
		if (n<0 || n>5000 || maxn==0) return console.log('invalid data', res);
		logmaxn = Math.log(maxn);
		$('#hist')[n>30?'removeClass':'addClass']('zoomed');
		function day(d, n, m, sn, sm){
			var date = new Date(d*24*60*60*1000),
				month = time.MMM[date.getMonth()]+' '+date.getFullYear();
			if (month != lastMonth) {
				$month = $('<div>').addClass('month').append(
					$('<div>').addClass('label').text(month)
				).appendTo($hist);
				lastMonth = month;
			}
			var $bar = $('<div/>').addClass('bar').css('width', Math.log(n)*80/logmaxn+'%');
			if (sm) $bar.addClass('hit');
			var $day = $('<div/>').addClass('day').append($bar).attr('d',d).attr('n',n).appendTo($month);
			if (m) $day.attr('m',m);
			if (sm) $day.attr('sm',sm).attr('sn',sn);
		}
		records.forEach(function(r){
			for(d++;d<r.d;d++) day(d,0);
			day(d=r.d, r.n, r.m, r.sn, r.sm);
		});
		$('#hist').scrollTop($('#hist')[0].scrollHeight);
		hist.showPage();
	}
	
	hist.showPage = function(){
		if (!visible) return;
		var sh = gui.$messageScroller.height();
		var $messages = $('#messages .message').filter(function(){
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
});
