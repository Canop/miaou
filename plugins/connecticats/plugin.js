
const path = require("path");
const fs = require("fs");
const lists = new Map;

function loadLists(){
	let listsDirPath= path.resolve(__dirname, 'lists');
	let files = fs.readdirSync(listsDirPath);
	let all = {
		name: "random",
		images: []
	};
	for (let file of files) {
		let collection = {
			name: file.split(".")[0],
			images: []
		};
		for (let line of fs.readFileSync(`${listsDirPath}/${file}`).toString().split("\n")) {
			let match = line.match(/^\s*(https:\S+)/);
			if (!match) continue;
			collection.images.push(match[1]);
			all.images.push(match[1]);
		}
		if (!collection.images.length) continue;
		lists.set(collection.name, collection);
	}
	if (all.images.length) lists.set(all.name, all);
}

function serveImage(req, res, next){
	let listName = req.query.list;
	if (!listName || !lists.get(listName)) listName = "random";
	let images = lists.get(listName).images;
	let image = images[Math.random()*images.length|0];
	res.redirect(image);
}

exports.init = function(miaou){
	loadLists();
	if (!lists.size) return;
	let names = lists.keys();
	miaou.lib("prefs").definePref(
		"connecticats.list", "none", "Pictures to display while waiting for the connection",
		[ "none", ...names]
	);
	console.log("pref defined");
}

exports.registerRoutes = function(map){
	map('get', '/connecticats', serveImage);
}
