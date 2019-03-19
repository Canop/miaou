// histogram and search functions
miaou(function(hist, gui, locals, md, time, ws){

	if (!locals.features) return; // it just tests whether we're in a chat/search page

	var	visible = false,
		currentSearch,
		currentResult,
		delayTimer,
		fields = new Set(["pattern", "starred", "starrer", "author", "exact", "regex", "img", "link", "authorName"]);

	function isCurrentSearch(s){
		if (!currentSearch) return false;
		for (var field of fields) {
			if (currentSearch[field] !== s[field]) return false;
		}
		return true;
	}

	function isSearchEmpty(s){
		s = s || currentSearch;
		if (!s) return true;
		for (var field of fields) {
			if (s[field]) return false;
		}
		return true;
	}

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
			var	mtop = $selected.offset().top,
				$scroller = $('#right'), stop = $scroller.offset().top, sst = $scroller.scrollTop();
			if (mtop<stop+sst) {
				$scroller.scrollTop(mtop-stop-25);
			} else if (mtop+$selected.height()+sst>stop+$scroller.height()) {
				$scroller.scrollTop(mtop+$selected.height()+sst-$scroller.height()+15);
			}
		}
	}

	hist.open = function(){
		visible = true;
		$('#hist').addClass("open");
		hist.fetchHistogram(isSearchEmpty() ? null : currentSearch);
	}

	hist.close = function(){
		visible = false;
		$('#hist').removeClass("open");
	}

	// request the histogram (not the search result list)
	hist.fetchHistogram = function(options){
		if (!visible) return;
		currentSearch = options;
		ws.emit('hist', options);
	}

	// request the search result messages
	hist.search = function(options){
		if (!options.page) options.page = 0;
		currentSearch = options;
		$("#search-load-bar").addClass("active");
		ws.emit('search', options);
	}

	// receive search results sent by the server
	hist.found = function(res){
		if (!isCurrentSearch(res.search)) {
			console.log('received results of another search', $('#search-input').val().trim(), res);
			return;
		}
		currentSearch = res.search;
		currentResult = res.result;
		$("#search-load-bar").removeClass("active");
		$("#search-results-navigator").addClass("enabled");
		$('#search-results').empty();
		if (!res.result.count) {
			$('#search-results-count').text("no result");
			$("#search-results-page").text("");
			$("#search-results-previous-page").removeClass("enabled");
			$("#search-results-next-page").removeClass("enabled");
			return;
		}
		let	page = res.search.page||0,
			nbPages = Math.ceil(res.result.count / res.search.pageSize);
		md.showSideMessages(res.result.messages, $('#search-results'), page);
		$('#search-results-count').text(res.result.count + " messages found");
		$("#search-results-page").text(`page ${page+1} / ${nbPages}`);
		$("#search-results-previous-page").toggleClass("enabled", page>0);
		$("#search-results-next-page").toggleClass("enabled", page<nbPages-1);
	}

	function transform(v){
		//return Math.log(v+1);
		return Math.sqrt(v * (3 + Math.log(v+1)));
	}

	// display search results histogram sent by the server
	hist.showHist = function(res){
		$('#hist').empty();
		var records = res.hist;
		if (!records || !records.length) return;

		var	d = records[0].d,
			n = records[records.length-1].d - d,
			$hist = $('#hist'),
			maxn = 0,
			maxtn,
			$month,
			lastMonth;
		$('#search-results .message.selected').removeClass('selected');
		records.forEach(function(r){
			maxn = Math.max(maxn, r.n);
		});
		if (n<0 || n>5000 || maxn==0) return console.log('invalid data', res);
		maxtn = transform(maxn);
		$('#hist')[n>30?'removeClass':'addClass']('zoomed');
		var sum = 0;
		function day(d, n, sn){
			var	date = new Date(d*24*60*60*1000),
				month = time.MMM[date.getMonth()]+' '+date.getFullYear();
			if (month != lastMonth) {
				$month = $('<div>').addClass('month').append(
					$('<div>').addClass('label').text(month)
				).appendTo($hist);
				lastMonth = month;
			}
			var $bar = $('<div/>').addClass('bar').css('width', transform(n)*80/maxtn + '%');
			var $day = $('<div/>').addClass('day').append($bar)
			.attr('d', d).attr('n', n).attr("sum", Math.floor(sum))
			.appendTo($month);
			if (sn) {
				$bar.addClass('hit');
				$day.attr('sn', sn);
			}
			if (sn) sum += sn;
		}
		records.forEach(function(r){
			for (d++;d<r.d;d++) day(d, 0);
			day(d=r.d, r.n, r.sn);
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
		var	fd = Math.floor($messages.first().dat('message').created / (24*60*60)),
			ld = Math.floor($messages.last().dat('message').created / (24*60*60));
		$('#hist .day').each(function(){
			var $this = $(this), d = +$(this).attr('d');
			$this[fd<=d && d<=ld ? 'addClass' : 'removeClass']('vis');
		});
	}

	$('#hist').on('click', '.day', function(){
		var	$this = $(this),
			sn = +$this.attr('sn'),
			d = +$this.attr('d');
		ws.emit("get_after_time", {
			search: sn ? currentSearch : null,
			minCreated: d*24*60*60
		});
		if (currentResult && currentResult.count) {
			var page = Math.floor((currentResult.count-$this.attr("sum"))/currentSearch.pageSize);
			currentSearch.page = page;
			hist.search(currentSearch);
		}
	}).on('mouseenter', '.day', function(){
		var	sn = +$(this).attr('sn'),
			n = +$(this).attr('n'),
			d = +$(this).attr('d'),
			h = time.formatDateDDMMM(new Date(d*24*60*60*1000));
		if (n) h += ' - ' + n + ' messages';
		if (sn) h += '<br>' + sn + ' match';
		if (sn>1) h += 'es';
		$(this).append($('<div>').addClass('bubble').html(h));
	}).on('mouseleave', '.day', function(){
		$('#hist .bubble').remove();
	});

	function startSearch(){
		clearTimeout(delayTimer);
		var options = buildSearchOptions();
		if (isCurrentSearch(options)) return;
		if (isSearchEmpty(options)) {
			currentSearch = options;
			$('#search-results').empty();
			$("#search-results-navigator").removeClass("enabled");
			$('#hist .bar').removeClass('hit').removeAttr('sn');
		} else {
			delayTimer = setTimeout(function(){
				hist.search(options);
				hist.fetchHistogram(options);
			}, 900);
		}
	}

	// read the inputs to build the search object
	function buildSearchOptions(){
		var options = {pattern: $('#search-input').val().trim()};
		if ($("#search-starred").prop("checked")) {
			if ($("#search-starred-by-me").prop("checked")) {
				options.starrer = locals.me.id;
			} else {
				options.starred = true;
			}
		}
		if ($("#search-written").prop("checked")) {
			if ($("#search-written-by-me").prop("checked")) {
				options.author = locals.me.id;
			} else if ($("#search-author").val().trim()) {
				options.authorName = $("#search-author").val().trim();
			}
		}
		options.img = $("#search-img").prop("checked");
		options.link = $("#search-link").prop("checked");
		options.exact = $("#search-exact").prop("checked");
		options.regex = $("#search-regex").prop("checked");
		return options;
	}

	$('#search-button').click(startSearch);
	$("#search input").change(startSearch);
	if (!gui.mobile) {
		$("#search-author").focus(function(){
			$("#search-written-by").prop("checked", true);
		}).keyup(function(e){
			if (e.which===13) { // enter
				startSearch();
			}
		}).on("change blur", startSearch);
		$("#search-img, #search-link").on("change", startSearch);
		$('#search-input').on('keyup', function(e){
			if (e.which===27 && typeof window.righttab === "function") { // esc
				window.righttab("notablemessagespage"); // defined in page-js/pad.js
				$('#input').focus();
			} else if (e.which==38) { // up arrow
				moveSelect(-1);
			} else if (e.which==40) { //down arrow
				moveSelect(1);
			} else {
				startSearch();
			}
		});
	}

	$("#search-results-previous-page").click(function(){
		if (!currentSearch || !this.classList.contains("enabled")) return;
		currentSearch.page--;
		hist.search(currentSearch);
	});
	$("#search-results-next-page").click(function(){
		if (!currentSearch || !this.classList.contains("enabled")) return;
		currentSearch.page++;
		hist.search(currentSearch);
	});

	if (!gui.mobile) {
		var lines = [];
		lines.push(
			'Variations of words are found too, not just the exact occurence.',
			'If you type several words, all messages with one of those words will be found.',
			'For example if you type "car", messages with "cars" will be found, but '+
			'messages with "cargo" will be ignored.\n'
		);
		if (locals.features.search.exactExpressions) {
			lines.push(
				`To search for an exact expression, or for part of a word, check the "exact" box.`,
				`"A B" wouldn't match "B A"`,
				`"car" would match messages with "cars" and "cargos".\n`
			);
		} else {
			$('#search-exact,label[for="search-exact"]').hide();
		}
		if (locals.features.search.regularExpressions) {
			lines.push(
				`To search for regular expressions, check the "regex" checkbox.\n`
			);
		} else {
			$('#search-regex,label[for="search-regex"]').hide();
		}
		$("#search-regex").change(function(){
			if (this.checked) $("#search-exact").prop("checked", false);
			startSearch();
		});
		$("#search-exact").change(function(){
			if (this.checked) $("#search-regex").prop("checked", false);
			startSearch();
		});
		$("#search-input").bubbleOn({
			side: "left",
			md: lines.join("\n")
		});
	}
});
