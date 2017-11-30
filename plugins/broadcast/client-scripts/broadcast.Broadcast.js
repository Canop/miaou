// this code is shared between client and server parts of the plugin
(function(){

	var langRegex = /\s\[(x)?\s*\](\w\w)/g;
	var tagRegex = /\[tag:([\w-\s\/]{2,50})\]/g;

	// Broadcast object properties:
	//  - status : "draft", "sending", "sent"
	//  - langs : [{lang,on}]
	//  - tags : [tag]
	//  - content
	function Broadcast(md){
		var	b = this,
			contentLines = [];
		md.replace(/^!!broadcast\s*/, '').split("\n").forEach(function(line){
			var match;
			if (!b.langs && /^langs: /.test(line)) {
				b.langs = [];
				while ((match=langRegex.exec(line))) {
					b.langs.push({lang:match[2], on:!!match[1]});
				}
				return;
			}
			if (!b.status && (match=line.match(/^status: (.*)$/))) {
				b.status = match[1];
				return;
			}
			if (!b.tags && /^tags:/.test(line)) {
				b.tags = [];
				while ((match=tagRegex.exec(line))) {
					b.tags.push(match[1]);
				}
				return;
			}
			contentLines.push(line);
		});
		b.content = contentLines.join('\n');
		if (!b.tags) b.tags = [];
	}

	Broadcast.prototype.md = function(){
		var lines = [
			"!!broadcast",
			"status: " + this.status,
			"langs: " + this.langs.map(l => "[" + (l.on ? "x" : " ") +"]" + l.lang).join(" "),
			"tags: " + this.tags.map(t => "[tag:" + t + "]").join(" "),
			this.content
		];
		return lines.join("\n");
	}

	Broadcast.prototype.accept = function(room){

	}

	Broadcast.prototype.isValid = function(){
		return this.status && this.langs;
	}

	Broadcast.prototype.init = function(langs){
		this.status = "draft";
		this.langs = langs.map(l => ({lang:l, on:true}));
	}

	if (typeof module !== 'undefined') {
		module.exports = Broadcast;
	} else if (typeof miaou !== 'undefined') {
		miaou(function(broadcast){
			broadcast.Broadcast = Broadcast;
		});
	}

})();

