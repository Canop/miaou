// simple functions for time displaying

miaou(function(time){

	var	offsetWithServer = 0, // in seconds
		roomEnterTime; // in seconds since epoch, server time

	time.MMM = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	function pad(n){
		return n<10 ? "0"+n : n;
	}

	time.setRoomEnterTime = function(serverTime){
		roomEnterTime = serverTime;
		offsetWithServer = time.now() - serverTime;
	}

	time.isNew = function(message){
		return (message.changed||message.created)>roomEnterTime;
	}

	time.formatDateDDMMM = function(date){
		var d = date.getDate();
		return (d<10 ? '0' : '') + d + ' ' + time.MMM[date.getMonth()];
	}

	// choose whether to add a relative date or an absolute one depending on the age
	time.formatDateAuto = function(date){
		var	now = new Date,
			m = date.getMinutes(), h = date.getHours(), Y = date.getFullYear(),
			s = s = (h<10?'0':'')+h+':'+(m<10?'0':'')+m;
		if (now.getFullYear()===Y && now.getMonth()===date.getMonth() && now.getDate()===date.getDate()) {
			return s;
		}
		return time.formatDateDDMMM(date) + (Y!==now.getFullYear() ? (' '+Y) : '')  + ' ' + s;
	}

	time.formatDate = function(t, f){ // t:time in ms
		var	date = new Date(t);
		if (!f) return time.formatDateAuto(date);
		return f
		.replace(/YYYY/g, date.getFullYear())
		.replace(/YY/g, date.getFullYear().toString().slice(-2))
		.replace(/DD/g, date.getDate())
		.replace(/MMM/g, time.MMM[date.getMonth()])
		.replace(/MM/g, pad(date.getMonth()+1))
		.replace(/hh/g, pad(date.getHours()))
		.replace(/mm/g, pad(date.getMinutes()))
		.replace(/ss/g, pad(date.getSeconds()));
	}

	time.formatRelativeDate = function(t){ // time in ms
		var now = Date.now(), a = (now - t) / 1000;
		if (a < 50) return "a few seconds ago";
		if (a < 500) {
			var m = Math.round(a / 60);
			return m > 1 ? (m  + ' minutes ago') : 'a minute ago';
		}
		return time.formatDate(t);
	}

	// time : timestamp as provided in message.created or message.changed
	time.formatTime = function(t){
		return time.formatDate((t+offsetWithServer)*1000);
	}

	// time : timestamp as provided in message.created or message.changed
	time.formatRelativeTime = function(t){
		return time.formatRelativeDate((t+offsetWithServer)*1000);
	}


	// returns the passed server time in local time (both in seconds)
	time.local = function(t){
		return t+offsetWithServer;
	}

	// returns the local time, in seconds since Epoch
	time.now = function(){
		return Date.now()/1000|0;
	}

});
