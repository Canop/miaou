// replaces URL to SO questions, answers and comments with the relevant extract
// The filter parameter passed to SO API can be edited here :
//   https://api.stackexchange.com/docs/questions#order=desc&sort=activity&filter=!9YdnSJrC1&site=stackoverflow&run=true

var	http = require('http'),
	url = require('url'),
	zlib = require("zlib"),
	cache = require('bounded-cache')(300),
	Deque = require("double-ended-queue"),
	TTL = 2*60*60*1000, // big delay due to quota (fixme :  register)
	tasks = new Deque(200), currentTask;

// unzip and parse the response from a request to the SO API.
// SO API always answers with gzipped content (even if your headers forbid it, it seems)
// callback is given an error and a js object
function getFromSO(url, callback) {
    var buffer = [];
    http.get(url, function(res) {
        var gunzip = zlib.createGunzip();            
        res.pipe(gunzip);
        gunzip.on('data', function(data) {
            buffer.push(data.toString())
        }).on("end", function() {
			try {
				callback(null, JSON.parse(buffer.join('')));
			} catch (e) {
				callback(e);
			}
        }).on("error", function(e) {
            callback(e);
        });
    }).on('error', function(e) {
        callback(e)
    });
}

function dequeue(){
	if (currentTask) return;
	var task = tasks.shift();
	if (!task) return;
	currentTask = task;
	var box = cache.get(task.key);
	if (box !== undefined) {
		console.log('SO box', task.key, 'found in cache');
		return setTimeout(function(){
			currentTask = null;
			if (box) task.send('box', {mid:task.mid, from:task.line, to:box});
			dequeue();
		}, 0);
	}
	
	var url = "http://api.stackexchange.com/2.2/questions/"+task.num+"?site=stackoverflow&filter=!L_Zm1rmoFy)u)LqgLTvHLi";
	
	console.log("URL:", url);
	
	// http://cdn.sstatic.net/stackoverflow/img/apple-touch-icon.png
		
	getFromSO(url, function(error, data) {
		console.log('SO box', task.key, 'fetched');
		currentTask = null;
		setTimeout(dequeue, 0);
		if (error) {
			console.log("ERROR:", error);
			cache.set(task.key, null, TTL);
			return;
		}
		console.dir(data);
		if (!data.items || !data.items.length) {
			console.log("invalid answer (or bad SO url)");
			cache.set(task.key, null, TTL);
			return;
		}
		
		var item = data.items[0],
			side = '',
			main = '';
		
		console.log('tags', item.tags);
		console.log('owner', item.owner);
		
		side += '<div class=so-q>Question</div>';
		side += '<div class=so-score>Score: <span class=num>'+item.score+'</span></div>';
		side += '<div class="so-answers'+(item.is_answered?' so-accepted':'')+'"><span class=num>'+item.answer_count+'</span> answers</div>';
		side += '<img class=so-owner-img src="'+item.owner.profile_image+'">';
		side += '<div class=so-owner-name>'+item.owner.display_name+'</div>';
		
		main += '<a target=_blank class=so-title href="'+item.link+'">'+
			'<img src=http://cdn.sstatic.net/stackoverflow/img/apple-touch-icon.png width=40>'+
			item.title+'</a>';
		main += '<div class=so-tags>'+item.tags.map(function(tag){ return '<span>'+tag+'</span>' }).join('')+'</div>';
		main += '<div class=so-body>'+item.body+'</div>';
		
		box = '<div class=stackoverflow><div class=so-side>'+side+'</div><div class=so-main>'+main+'</div></div>';		
		cache.set(task.line, box, TTL);
		task.send('box', {mid:task.mid, from:task.line, to:box, class:'stackoverflow'});
	   
	});
}

// task is an object whose properties are
//  - line : the line of text (URL to SO)
//  - type : "questions" | "answers" | "comments"
//  - num  : id of the thing
//  - mid  : the id of the message 
//  - send : box sending function
exports.addTask = function(task){
	task.key = task.type+'.'+task.num;
	tasks.push(task);
	dequeue();
}
