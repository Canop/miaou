const	fmt = require("../../libs/fmt.js"),
	ws = require("../../libs/ws.js"),
	path = require("path"),
	alarmMap = new Map; // map messageId => alarm

var	db,
	bot;

exports.name = "pingme";

exports.init = function(miaou){
	db = miaou.db;
	bot = miaou.bot;
	db.upgrade(exports.name, path.resolve(__dirname, 'sql'));
	load();
}

const durationUnits = [
	{regex: /^years?,?$/i, seconds: 365*24*60*60}, // approximative, yes
	{regex: /^days?,?$/i, seconds: 24*60*60},
	{regex: /^hours?,?$/i, seconds: 60*60},
	{regex: /^min(ute?)?s?,?$/i, seconds: 60},
	{regex: /^seconde?s?,?$/i, seconds: 1},
];

// fetches the alarm from BD
function load(){
	// in case the restart is slow, it's better playing recently expired alarms
	var time = Math.floor(Date.now()/1000) - 3*60;
	// we don't do it immediately, because user reconnexion has priority
	setTimeout(function(){
		db.on()
		.then(function(){
			return this.queryRows(
				"select p.name as username, m.room, m.created,"+
				" a.message, a.ping_date as date, a.alarm_text as text,"+
				" a.repeat as repeat"+
				" from pingme_alarm a join message m on m.id=a.message"+
				" join player p on p.id=m.author"+
				" where a.ping_date>$1",
				[time],
				"list_pingme_alarms"
			);
		})
		.then(function(alarms){
			console.log('loaded alarms:', alarms.length);
			alarms.forEach(function(alarm){
				programPing(alarm);
			});
		})
		.finally(db.off);
	}, 15*1000);
}

// returns the integer formatted with two digits (e.g. "03")
function td(num){
	return (num<10 ? "0": "") + num;
}

// takes a timezone offset in minutes (a number) and
// returns a string that can be used in an ISO 8601 formatted date
function minutesToIsoOffset(minutes){
	var str;
	if (minutes<0) {
		str = "-";
		minutes = -minutes;
	} else {
		str = "+";
	}
	str += td(Math.floor(minutes/60));
	str += ":" + td(minutes%60);
	return str;
}

const weekDays = {
	sunday: 0, dimanche: 0,
	monday: 1, lundi: 1,
	tuesday: 2, mardi: 2,
	wednesday: 3, mercredi: 3,
	thursday: 4, jeudi: 4,
	friday: 5, vendredi: 5,
	saturday: 6, samedi: 6,
}

// parse repeatable pingmes like "every day at 15h"
function parseAsEvery(tokens, tzoffset, now){
	// this function is messy and probably super wrong
	// but I'm too lazy to dive again into timezones to
	// write the right code
	let theDay = new Date(now.getTime() + tzoffset*60*1000);
	let tok;
	let every = [];
	function takeTok(){
		tok = tokens.shift();
		every.push(tok);
	}
	takeTok(); // takes "every" or "chaque"
	takeTok();
	let weekDay = weekDays[tok.toLowerCase()];
	if (weekDay != undefined) {
		// example:
		// chaque lundi à 18h apéro
		takeTok();
		if (/^(at|à|a)/.test(tok)) takeTok();
		mat = tok.match(/(\d{1,2})[:h](\d{2})?,?/);
		if (!mat) {
			throw new Error("I was expecting an hour like 15:56 or 14h, not \"" + tok + "\"");
		}
		hour = +mat[1];
		minute = +mat[2] || 0;
		let year = theDay.getUTCFullYear();
		let month = theDay.getUTCMonth();
		let day = theDay.getUTCDate();
		var strDate = year+"-"+td(month+1)+"-"+td(day)+"T"+td(hour)+":"+td(minute);
		strDate += minutesToIsoOffset(-tzoffset);
		let date = Date.parse(strDate);
		if (date<now) {
			date += 24*60*60*1000;
		}
		theDay = new Date(date + tzoffset*60*1000);
		let good = false;
		for (var i=0; i<8; i++) {
			good = weekDay == theDay.getUTCDay();
			if (good) break;
			theDay.setUTCDate(theDay.getUTCDate()+1); // this handles month overflows
		}
		if (!good) {
			throw new Error("such date doesn't seem to exist");
		}
		year = theDay.getUTCFullYear();
		month = theDay.getUTCMonth();
		day = theDay.getUTCDate();
		strDate = year+"-"+td(month+1)+"-"+td(day)+"T"+td(hour)+":"+td(minute);
		strDate += minutesToIsoOffset(-tzoffset);
		date = Date.parse(strDate);
		return {
			repeat: every.join(' '),
			date: Math.round(date/1000),
			text: tokens.join(' ')
		};
	} else if (/^years?$/.test(tok) || /^an(née)?s?$/.test(tok)) {
		// examples:
		// "every year on 07/05 at 17h"
		// "chaque année le 07/05 à 19h"
		takeTok();
		if (/^(on|le|the)/.test(tok)) takeTok();
		let mat = tok.match(/(\d{1,2})\/(\d{1,2})/);
		if (!mat) {
			throw new Error("I was expecting a date like 07/11, not \"" + tok + "\"");
		}
		let day = +mat[1];
		let month = +mat[2];
		if (day<1 || day>31 || month<1 || month>12) {
			throw new Error("Date not understood");
		}
		month--;
		takeTok();
		if (/^(at|à|a)/.test(tok)) takeTok();
		mat = tok.match(/(\d{1,2})[:h](\d{2})?,?/);
		if (!mat) {
			throw new Error("I was expecting an hour like 15:56 or 14h, not \"" + tok + "\"");
		}
		hour = +mat[1];
		minute = +mat[2] || 0;
		// dumb algo: increment days until it's ok
		theDay.setUTCDate(theDay.getUTCDate()+1); // this handles month overflows
		let good = false;
		for (var i=0; i<1200; i++) { // accounts for 29/02
			good = month == theDay.getUTCMonth() && day == theDay.getUTCDate();
			if (good) break;
			theDay.setUTCDate(theDay.getUTCDate()+1); // this handles month overflows
		}
		if (!good) {
			throw new Error("such date doesn't seem to exist");
		}
		let year = theDay.getUTCFullYear();
		var strDate = year+"-"+td(month+1)+"-"+td(day)+"T"+td(hour)+":"+td(minute);
		strDate += minutesToIsoOffset(-tzoffset);
		date = Date.parse(strDate);
		return {
			repeat: every.join(' '),
			date: Math.round(date/1000),
			text: tokens.join(' ')
		};
	} else if (/^month?$/.test(tok) || /^mois$/.test(tok)) {
		// examples:
		// "every month on 07 at 17h"
		// "chaque mois le 07 à 19h"
		takeTok();
		if (/^(on|le|the)/.test(tok)) takeTok();
		let day = + tok;
		if (!day || day<1 || day>31) {
			throw new Error("Day not understood");
		}
		takeTok();
		if (/^(at|à|a)/.test(tok)) takeTok();
		mat = tok.match(/(\d{1,2})[:h](\d{2})?,?/);
		if (!mat) {
			throw new Error("I was expecting an hour like 15:56 or 14h, not \"" + tok + "\"");
		}
		hour = +mat[1];
		minute = +mat[2] || 0;
		// dumb algo: increment days until it's ok
		theDay.setUTCDate(theDay.getUTCDate()+1); // this handles month overflows
		let good = false;
		for (var i=0; i<33; i++) {
			good = day == theDay.getUTCDate();
			if (good) break;
			theDay.setUTCDate(theDay.getUTCDate()+1); // this handles month overflows
		}
		if (!good) {
			throw new Error("such date doesn't seem to exist");
		}
		let year = theDay.getUTCFullYear();
		let month = theDay.getUTCMonth();
		var strDate = year+"-"+td(month+1)+"-"+td(day)+"T"+td(hour)+":"+td(minute);
		strDate += minutesToIsoOffset(-tzoffset);
		date = Date.parse(strDate);
		return {
			repeat: every.join(' '),
			date: Math.round(date/1000),
			text: tokens.join(' ')
		};
	} else if (/^(day|jour)s?$/.test(tok)) {
		// examples:
		// "every day at 8h"
		// "chaque jour à 9h30"
		takeTok();
		if (/^(at|à|a)/.test(tok)) takeTok();
		mat = tok.match(/(\d{1,2})[:h](\d{2})?,?/);
		if (!mat) {
			throw new Error("I was expecting an hour like 15:56 or 14h, not \"" + tok + "\"");
		}
		hour = +mat[1];
		minute = +mat[2] || 0;
		let year = theDay.getUTCFullYear();
		let month = theDay.getUTCMonth();
		let day = theDay.getUTCDate();
		var strDate = year+"-"+td(month+1)+"-"+td(day)+"T"+td(hour)+":"+td(minute);
		strDate += minutesToIsoOffset(-tzoffset);
		let date = Date.parse(strDate);
		if (date<now.getTime()) {
			date += 24*60*60*1000;
		}
		return {
			repeat: every.join(' '),
			date: Math.round(date/1000),
			text: tokens.join(' ')
		};
	} else {
		throw new Error("I didn't understand this 'every' pingme query");
	}
}

// parse arguments without duration like "!!pingme tomorrow 5h some text"
function parseAsAt(tokens, tzoffset, now){
	var	m,
		i,
		todayWithOffset,
		hourSet = false,
		daySet = false,
		date,
		year, month, day, hour, minute,
		textTokens = [];
	for (i=0; i<tokens.length; i++) {
		var token = tokens[i];
		if (!hourSet && /at/i.test(token)) continue;
		if (!daySet && (m = token.match(/(?:(\d{4})(?:\/))?(\d{1,2})\/(\d{1,2})(?:(?:\/)(\d{4}))?/))) {
			if (m[1] && m[4]) throw new Error("Weird date: " + token);
			year = m[4] || m[1] || now.getUTCFullYear();
			// we prefer European order
			if (m[1] || m[3]>12) {
				month = m[2]-1;
				day = +m[3];
			} else {
				month = m[3]-1;
				day = +m[2];
			}
			if (year>2100) throw new Error("Can't assume to be running so far in the future");
			if (day<1 || day>31 || month<0 || month>11) {
				throw new Error("Date not understood");
			}
			daySet = true;
		} else if (!daySet && /^tomm?orr?ow$/i.test(token)) {
			todayWithOffset = new Date(now.getTime() + tzoffset*60*1000);
			todayWithOffset.setUTCDate(todayWithOffset.getUTCDate()+1); // this handles month overflows
			year = todayWithOffset.getUTCFullYear();
			month = todayWithOffset.getUTCMonth();
			day = todayWithOffset.getUTCDate();
			daySet = true;
		} else if (!hourSet && (m = token.match(/(\d{1,2})[:h](\d{2})?,?/))) {
			hour = +m[1];
			minute = +m[2] || 0;
			if (hour<0 || hour>23 || minute<0 || minute>59) {
				throw new Error("Invalid hour or minutes: " + token);
			}
			hourSet = true;
		} else {
			textTokens.push(token);
		}
	}
	if (!hourSet) throw new Error("You must precise the time");
	if (!daySet) {
		todayWithOffset = new Date(now.getTime()+tzoffset*60*1000);
		year = todayWithOffset.getUTCFullYear();
		month = todayWithOffset.getUTCMonth();
		day = todayWithOffset.getUTCDate();
	}
	var strDate = year+"-"+td(month+1)+"-"+td(day)+"T"+td(hour)+":"+td(minute);
	strDate += minutesToIsoOffset(-tzoffset);
	// one of the reasons this code is awkward is I don't know any better way
	//  to parse a date accounting for a timezone offset
	date = Date.parse(strDate);
	if (date<now.getTime()) {
		date += 24*60*60*1000;
		if (date<now.getTime()) throw new Error("Can't program an alarm in the past");
	}
	if (!date) throw new Error("When do you want to be awoken?");
	return {
		date: Math.round(date/1000),
		text:textTokens.join(' ')
	};
}

// parse arguments with a duration like "!!pingme in 3 hours and 25 minutes back to work"
function parseAsIn(tokens, tzoffset, now){
	var	duration = 0,
		i,
		lastNumber = undefined,
		textTokens = [];
	for (i=1; i<tokens.length; i++) {
		var token = tokens[i];
		if (/^and$/i.test(token) && i) continue;
		if (token > 0) {
			if (lastNumber !== undefined) {
				textTokens.push(lastNumber);
			}
			lastNumber = +token;
		} else if (lastNumber!=undefined) {
			var found = false;
			for (var j=0; j<durationUnits.length; j++) {
				var du = durationUnits[j];
				if (du.regex.test(token)) {
					duration += lastNumber * du.seconds*1000;
					lastNumber = undefined;
					found = true;
					break;
				}
			}
			if (!found) break;
		} else {
			textTokens.push(token);
		}
	}
	if (!duration) throw new Error("Invalid duration");
	return {
		date: Math.round((now.getTime()+duration)/1000),
		text:textTokens.join(' ')
	};
}

// There's a problem here: As I know only the timezone offset, not the timezone,
//  I can't handle DST. I should probably get the user's timezone (not just the offset)
//  but it would mean add a lot of code to Miaou client until Firefox handles that part
//  of the standard.
// now should be passed only for test units (in other cases it's normally new Date).
exports.parse = function(str, tzoffset, now){
	var	tokens = str.match(/\S+/g);
	if (!now) now = new Date;
	if (/^in$/i.test(tokens[0])) {
		return parseAsIn(tokens, tzoffset, now);
	} else if (/^(every|chaque)$/i.test(tokens[0])) {
		return parseAsEvery(tokens, tzoffset, now);
	} else {
		return parseAsAt(tokens, tzoffset, now);
	}
}

async function doAlarm(alarm, shoe, silentRemoval){
	console.log('doAlarm:', alarm);
	await db.do(async function(con){
		let existingDbAlarm = await con.queryOptionalRow(
			"select ping_date, alarm_text from pingme_alarm where message=$1",
			[alarm.message],
			"message_pingme"
		);
		if (existingDbAlarm) {
			if (!silentRemoval) {
				await shoe.botReply(
					bot, alarm.message, "Previous alarm for this message is removed"
				);
			}
			await con.execute(
				"delete from pingme_alarm where message=$1",
				[alarm.message],
				"delete_pingme"
			);
		}
		var formattedDate = fmt.date(alarm.date, "YYYY/MM/DD hh:mm");
		let content = `@${shoe.publicUser.name}#${alarm.message} I'll ping you on ${formattedDate}`;
		await ws.botMessage(bot, alarm.room, content);
		let message = await con.getMessage(alarm.message);
		if (!message) {
			console.log("no message found for alarm", alarm);
			return;
		}
		if (message.author != shoe.publicUser.id) {
			console.log("author mismatch message=", message, "alarm=", alarm);
			return;
		}
		alarm.room = message.room;
		alarm.username = shoe.publicUser.name;
		programPing(alarm);
		await con.execute(
			"insert into pingme_alarm (message, ping_date, creator, alarm_text, repeat)"+
			" values ($1, $2, $3, $4, $5)",
			[alarm.message, alarm.date, shoe.publicUser.id, alarm.text, alarm.repeat],
			"insert_pingme_alarm"
		);
	});
}

// handle a user request to repeat a pingme
async function wsRepeat(shoe, arg){
	console.log('arg:', arg);
	if (!arg.pingme) {
		console.log("missing pingme in ws repeat command", arg);
		return;
	}
	let alarm = parseAsEvery(arg.repeat.split(' '), shoe.publicUser.tzoffset, new Date);
	alarm.message = arg.pingme; // the id of the original pingme message
	alarm.text = arg.text;
	await db.do(async function(con){
		let pingMessage = await con.getMessage(arg.mid);
		if (!pingMessage) {
			console.error("pingme message not found");
			return;
		}
		alarm.room = pingMessage.room;
		pingMessage.content = pingMessage.content.split("#pingme-repeat")[0];
		await con.storeMessage(pingMessage, true);
	});
	if (!alarm.room) {
		return;
	}
	console.log("REPEAT pingme", alarm);
	await doAlarm(alarm, shoe, true);
}

function doCommandNewAlarm(ct){
	let tzoffset = ct.shoe.publicUser.tzoffset;
	if (tzoffset===undefined) throw new Error("unknown timezone");
	var alarm = exports.parse(ct.args, tzoffset);
	ct.withSavedMessage = async function(shoe, message){
		alarm.message = message.id;
		alarm.room = message.room;
		await doAlarm(alarm, shoe, false);
		ct.end("create");
	}
}

function getUserActiveAlarms(ct, db){
	return db.queryRows(
		"select m.room, m.created, a.message, a.ping_date, a.alarm_text, a.repeat"+
		" from pingme_alarm a join message m on m.id=a.message"+
		" where a.creator=$1 and a.ping_date>$2",
		[ct.shoe.publicUser.id, Date.now()/1000|0],
		"list_pingme_player_alarms"
	);
}

// builds a Markdown table of the alamrs
function alarmsListMarkdown(alarms){
	if (!alarms.length) return "*No programmed alarm*";
	return "Your alarms:\n#|Message|Alarm Date|Text|Repeat\n:-:|:-:|:-:|:-|:-\n"+
	alarms.map(
		(a, i) => [
			i+1,
			"["+fmt.date(a.created, "YYYY/MM/DD hh:mm")+"]("+a.room+"#"+a.message+")",
			fmt.date(a.ping_date, "YYYY/MM/DD hh:mm"),
			"`"+a.alarm_text.replace(/`/g, "'")+"`",
			"`"+(a.repeat||'').replace(/`/g, "'")+"`"
		].join("|")
	).join("\n");
}

function doCommandListAlarms(ct){
	return getUserActiveAlarms(ct, this)
	.then(function(alarms){
		ct.nostore = true;
		ct.reply(alarmsListMarkdown(alarms), true);
		ct.end("list");
	});
}

async function doCommandCancelAlarm(ct, num){
	var alarms = await getUserActiveAlarms(ct, this)
	var removed = alarms.splice(num-1, 1);
	if (!removed.length) {
		await ct.reply(
			"Alarm not found.\nUse `!!pingme list` to see alarms and their id", true
		);
		return;
	}
	removed = removed[0];
	var existingAlarm = alarmMap.get(removed.message); // not defined if previous alarm already done
	if (existingAlarm && existingAlarm.timeout) {
		existingAlarm.timeout.clear();
	}
	ct.reply("Alarm removed.\n" + alarmsListMarkdown(alarms), true);
	await this.execute(
		"delete from pingme_alarm where message=$1",
		[removed.message],
		"delete_pingme",
		false
	);
	ct.end("cancel");
}

function onCommand(ct){
	if (!ct.args) {
		return ct.reply("The `!!pingme` command needs argument. Try `!!help pingme` for more information.", true);
	}
	if (/^list\b/i.test(ct.args)) return doCommandListAlarms.call(this, ct);
	var m = ct.args.match(/^cancel\s+(\d+)\b/i);
	if (m) return doCommandCancelAlarm.call(this, ct, +m[1]);
	return doCommandNewAlarm(ct);
}

// node's setTimeout doesn't handle delays of more than about 24 days
function setBigTimeout(fun, delay){
	const MAX_STEP_TIMEOUT = 2147483647; // 2^31-1
	var timer;
	(function step(){
		if (delay<=0) return fun();
		timer = setTimeout(step, Math.min(MAX_STEP_TIMEOUT, delay));
		delay -= MAX_STEP_TIMEOUT;
	})();
	return {
		clear: function(){
			clearTimeout(timer);
		}
	};
}

function programPing(alarm){
	var existingAlarm = alarmMap.get(alarm.message); // not defined if previous alarm already done
	if (existingAlarm && existingAlarm.timeout) existingAlarm.timeout.clear();
	alarmMap.set(alarm.message, alarm);
	alarm.timeout = setBigTimeout(function(){
		console.log("Ringing alarm:", alarm);
		var text = alarm.text||"drrriiiiiinnnngggg!";
		if (alarm.repeat) {
			text += `\n#pingme-repeat(${alarm.repeat})`;
		}
		ws.botMessage(bot, alarm.room, "@"+alarm.username+"#"+alarm.message+" "+text, function(m){
			return ws.pingUser.call(
				this,
				alarm.room,
				alarm.username,
				m.id,
				"!!pingme",
				text
			);
		});
		alarmMap.delete(alarm.message);
	}, Math.max(0, alarm.date*1000-Date.now()));
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name: 'pingme',
		fun: onCommand,
		help: "ask Miaou to ping you in the future. Example: `!!pingme at 14h25 meeting`",
		detailedHelp:"Examples:"
			+ "\n* `!!pingme 14h25 meeting`"
			+ "\n* `!!pingme tomorrow 22h`"
			+ "\n* `!!pingme 00h15 rendez-vous synchro`"
			+ "\n* `!!pingme in 3 hours and 24 minutes`"
			+ "\n* `!!pingme in 3 hours`"
			+ "\n* `!!pingme meeting at 23h at the pub`"
			+ "\n* `!!pingme at 3h`"
			+ "\n* `!!pingme in 5 minutes back to work`"
			+ "\n* `!!pingme 2025/02/23 4h05`"
			+ "\n* `!!pingme 2018/03/11 6h Christine's birthday`"
			+ "\n* `!!pingme every 03/11 6h Christine's birthday`"
			+ "\n* `!!pingme every day at 7h take your pills`"
			+ "\n* `!!pingme every tuesday chek water level`"
			+ "\n* `!!pingme list` : list all your alarms"
			+ "\n* `!!pingme cancel 3` : cancel one of your alarms"
			+ "\n## Note:"
			+ "\nDue to some browser limitations, Miaou doesn't know when you're in Daylight Saving Time."
			+ "\nIt means there can be an error of one hour if you program an alarm accross a DST change."
	});
}

exports.onNewShoe = function(shoe){
	shoe.socket
	.on('pingme.repeat', function(arg){
		wsRepeat(shoe, arg)
	})
}



