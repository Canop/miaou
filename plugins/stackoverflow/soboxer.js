// replaces URL to SO questions, answers and comments with the relevant extract
// The filter parameter passed to SO API can be edited here :
//   https://api.stackexchange.com/docs/questions#order=desc&sort=activity&filter=!9YdnSJrC1&site=stackoverflow&run=true

var	http = require('http'),
	url = require('url'),
	zlib = require("zlib"),
	cache = require('bounded-cache')(300),
	Deque = require("double-ended-queue"),
	apiurl = "http://api.stackexchange.com/2.2/",
	apikey, // necessary to get a bigger quota (10 000 instead of 300)
	TTL = 15*60*1000,
	tasks = new Deque(2000), currentTask;
	
function logoCDN(task){
	var img = '<img src=http://cdn.sstatic.net/'+task.site.split('.')[0];
	if (task.meta) img += 'meta';
	img += '/img/apple-touch-icon.png width=40>';
	return img;
}

var handlers = {
	"questions":{
		filter:"!L_Zm1rmoFy)u)LqgLTvHLi",
		dobox:function(item, task){ // builds the HTML of a question from its JSON element as sent by the SO API
			var side = '', main = '';

			side += '<div class=so-type>Question</div>';
			side += '<div class=so-score>Score: <span class=num>'+item.score+'</span></div>';
			side += '<div class="so-answers'+(item.is_answered?' so-accepted':'')+'"><span class=num>'+item.answer_count+'</span> answers</div>';
			side += '<img class=so-owner-img src="'+item.owner.profile_image+'">';
			side += '<div class=so-owner-name>'+item.owner.display_name+'</div>';

			main += '<a target=_blank class=so-title href="'+task.line+'">'+logoCDN(task)+item.title+'</a>';
			main += '<div class=so-tags>'+item.tags.map(function(tag){ return '<span>'+tag+'</span>' }).join('')+'</div>';
			main += '<div class=so-body>'+item.body+'</div>';
			
			return '<div class=stackexchangebox><div class=so-side>'+side+'</div><div class=so-main>'+main+'</div></div>';
		}
	},
	"answers":{
		filter:"!)6EG5Z9Ys.RpJe_vSYewAIdDZ-cm",
		dobox:function(item, task){ // builds the HTML of an answer from its JSON element as sent by the SO API
			var side = '', main = '';

			side += '<div class=so-type>Answer</div>';
			side += '<div class="so-score'+(item.is_accepted?' so-accepted':'')+'">Score: <span class=num>'+item.score+'</span></div>';
			side += '<img class=so-owner-img src="'+item.owner.profile_image+'">';
			side += '<div class=so-owner-name>'+item.owner.display_name+'</div>';

			main += '<a target=_blank class=so-title href="'+task.line+'">'+
				'<img src=http://cdn.sstatic.net/'+task.site+'/img/apple-touch-icon.png width=40>'+
				item.title+'</a>';
			main += '<div class=so-tags>'+item.tags.map(function(tag){ return '<span>'+tag+'</span>' }).join('')+'</div>';
			main += '<div class=so-body>'+item.body+'</div>';
			
			return '<div class=stackexchangebox><div class=so-side>'+side+'</div><div class=so-main>'+main+'</div></div>';
		}
	},
	"comments":{
		filter:"!*K)GSjDWh5D7ZCvl",
		dobox:function(item, task){
			var side = '', main = '';

			side += '<div class=so-type>Comment</div>';
			side += '<div class=so-score>Score: <span class=num>'+item.score+'</span></div>';

			main += '<span class=so-comment>'+item.body+'</span> - ';
			main += '<a target=_blank class=so-comment-link href='+task.line+'">'+
				item.owner.display_name+' <i>'+
				Date(item.creation_date)+ // todo make the browser compute the date using the locale
				'</i></a>';
			
			return '<div class=stackexchangebox><div class=so-side>'+side+'</div><div class=so-main>'+main+'</div></div>';
			
		}
	}
};

// unzip and parse the response from a request to the SO API.
// SO API always answers with gzipped content (even if your headers forbid it, it seems)
// callback is given an error and a js object
function getFromSO(url, callback){
    var buffer = [];
    http.get(url, function(res) {
        var gunzip = zlib.createGunzip();            
        res.pipe(gunzip);
        gunzip.on('data', function(data){
            buffer.push(data.toString())
        }).on("end", function(){
			try {
				callback(null, JSON.parse(buffer.join('')));
			} catch (e) {
				callback(e);
			}
        }).on("error", function(e){
            callback(e);
        });
    }).on('error', function(e){
        callback(e)
    });
}

function dequeue(){
	if (currentTask) return;
	var task = tasks.shift();
	if (!task) return;
	currentTask = task;
	//~ console.log("Doing", task);
	var box = cache.get(task.key);
	if (box !== undefined) {
		//~ console.log('SO box', task.key, 'found in cache');
		return setTimeout(function(){
			currentTask = null;
			if (box) task.send('box', {mid:task.mid, from:task.line, to:box});
			dequeue();
		}, 50);
	}
	var handler = handlers[task.type],
		url = apiurl+task.type+"/"+task.num+"?site="+(task.meta?'meta.':'')+task.site+"&filter="+handler.filter;
	if (apikey) url += "&key="+apikey;
	//~ console.log("SE API URL", url);
	getFromSO(url, function(error, data) {
		//~ console.log('SO box', task.key, 'fetched');
		currentTask = null;
		setTimeout(dequeue, 50);
		if (error) {
			console.log("ERROR:", error);
			cache.set(task.key, null, TTL);
			return;
		}
		//~ console.dir(data);
		if (!data.items || !data.items.length) {
			console.log("invalid answer (or bad SO url)");
			cache.set(task.key, null, TTL);
			return;
		}
		var box = handler.dobox(data.items[0], task);
		cache.set(task.key, box, TTL);
		task.send('box', {mid:task.mid, from:task.line, to:box});	   
	});
}

// task is an object whose properties are
//  - line : the line of text (URL to SO)
//  - type : "questions" | "answers" | "comments"
//  - site : "stackoverflow" | "askubuntu" | ...
//  - meta : false | true
//  - num  : id of the thing
//  - mid  : the id of the message 
//  - send : box sending function
exports.addTask = function(task){
	task.key = task.type+'.'+task.num;
	tasks.push(task);
	dequeue();
}

// read the text to find and analyze SE URL
exports.rawTasks = function(text){
	var	tasks = [],
		r = /(?:^|\n)\s*https?:\/\/(meta\.)?(stackoverflow|askubuntu|(?:dba\.)?stackexchange|superuser).com\/(a|q|questions)\/(\d+)(\/[^\s#]*)?(#\S+)?\s*(?:$|\n)/gm,
		match;
	while (match=r.exec(text)) {
		var	path = match[5], submatch,
			hash = match[6],
			task = { line:match[0], meta:!!match[1], site:match[2] };
		if ( hash && (submatch=hash.match(/^#comment(\d+)_\d+$/)) ) {
			task.type = "comments";
			task.num = +submatch[1];			
		} else if ( match[3]==='a' ) {
			task.type = "answers";
			task.num = +match[4];
		} else if ( path && (submatch=path.match(/^\/[^\/]+\/(\d+)$/)) ) {
			task.type = "answers";
			task.num = +submatch[1];			
		} else {
			task.type = "questions";
			task.num = +match[4];
		}
		tasks.push(task);
	}
	return tasks;
}


exports.init = function(miaou){
	try {
		apikey = miaou.config.oauth2.stackexchange.key;
	} catch (e) {
		console.log("No API key for Stack Overflow boxing - reduced quota");
	}
}
