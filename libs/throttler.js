
const periods = {
	day: 24*60*60, // I'm not sure this one really makes sense
	hour: 60*60,
	minute: 60
};

const throttlers = [];

class RateLimitError extends Error{
	constructor(userId, limit, period){
		let str = `User ${userId} exceeded the rate limit of ${limit} actions per ${period}`;
		super(str);
		this.log = str;
		Error.captureStackTrace(this, RateLimitError);
	}
}

class PeriodThrottler{
	constructor(name, limit){
		this.name = name;
		this.limit = limit;
		this.counts = new Map; // userId => count
	}
	run(){
		setInterval(()=>{
			this.counts.clear();
		}, periods[this.name]*1000);
	}
	check(userId){
		let n = this.counts.get(userId) || 0;
		this.counts.set(userId, ++n);
		if (n > this.limit) throw new RateLimitError(userId, this.limit, this.name);
	}
}

exports.configure = function(miaou){
	for (let name in periods) {
		let limit = +miaou.conf("throttler", name);
		if (!limit) continue;
		let throttler = new PeriodThrottler(name, limit);
		throttlers.push(throttler);
		throttler.run();
	}
}
exports.throttle = function throttle(userId){
	for (let throttler of throttlers) throttler.check(userId);
};
