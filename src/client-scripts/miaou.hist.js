var miaou = miaou || {};

(function(){
	miaou.hist = {}
	
	miaou.hist.search = function(pattern) {
		miaou.socket.emit('hist', {}, function(res){
			console.log(res);
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
