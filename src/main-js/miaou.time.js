// simple functions for time displaying

miaou.MMM = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

miaou.formatDateDDMMM = function(date){
	var d = date.getDate();
	return (d<10 ? '0' : '') + d + ' ' + miaou.MMM[date.getMonth()];
}

miaou.formatDate = function(t){ // time in ms
	var date = new Date(t), now = new Date,
		m = date.getMinutes(), h = date.getHours(), Y = date.getFullYear(),
		s = s = (h<10?'0':'')+h+':'+(m<10?'0':'')+m;
	if (now.getFullYear()===Y && now.getMonth()===date.getMonth() && now.getDate()===date.getDate()) {
		return s;
	}
	return miaou.formatDateDDMMM(date) + (Y!==now.getFullYear() ? (' '+Y) : '')  + ' ' + s;
}

miaou.formatRelativeDate = function(t){ // time in ms
	var now = Date.now(), a = (now - t) / 1000;
	if (a < 50) return "a few seconds ago";
	if (a < 500) {
		var m = Math.round(a / 60);
		return m > 1 ? (m  + ' minutes ago') : 'a minute ago';
	}
	return miaou.formatDate(t);
}

// time : timestamp as provided in message.created or message.changed
miaou.formatTime = function(t){
	return miaou.formatDate((t+miaou.chat.timeOffset)*1000);
}

// time : timestamp as provided in message.created or message.changed
miaou.formatRelativeTime = function(t){
	return miaou.formatRelativeDate((t+miaou.chat.timeOffset)*1000);
}
