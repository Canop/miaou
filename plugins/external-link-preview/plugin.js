// this plugin adds a html-bubble attribute to links when it could read the
// information provided by the remote page. This attribute is expanded into
// a bubble client-side.
//
// Links with query parameters are ignored (we neither want to query a
// dynamic page or cache something which is suspected to be dynamic)

const	fetch = require('node-fetch'),
	$$ = require('cheerio'),
	cache = require('bounded-cache')(1000); // url -> promise

let bench;

exports.init = function(miaou){
	bench = miaou.lib("bench");
}

exports.registerRoutes = map=>{
	map("get", /^\/json\/external-link-preview$/, async function(req, res, next){
		res.setHeader("Cache-Control", "public, max-age=3600"); // une heure
		let url = req.query.url;
		try {
			if (!/^https?:\/\/[^\s"]+$/.test(url)) {
				throw new Error("Invalid URL given to external link previewer: \""+url+"\"");
			}
			let con = await getContent(url);
			res.json(con);
		} catch (err) {
			res.json({error: err.toString()});
		}
	});
}

// return a promise which either is solved with a non null content
// or rejects
function getContent(url){
	console.log('read content of:', url);
	let p = cache.get(url);
	if (!p) {
		benchOperation = bench.start("external-link-preview / build"),
		p = fetch(url, {
			size: 5*1024*1024,
		})
		.then(res => {
			if (!res.ok) throw new Error("Error in fetching " + url);
			if (!/^text\/html/i.test(res.headers.get('content-type'))) {
				throw new Error("no html in return of", url);
			}
			return res.text();
		})
		.then(html => {
			try {
				let $ = $$.load(html);
				con = readOpenGraph($) || readBasic($);
			} catch (err) {
				console.error("BUG in get preview:", err);
				throw new Error("bug in computing preview");
			}
			if (!con) throw new Error("empty preview");
			if (con.site_name==con.title) con.site_name = undefined;
			benchOperation.end();
			return con;
		});
		cache.set(url, p);
	}
	return p;
}

// read information following the Open Graph protocol
function readOpenGraph($){
	let con = {};
	let n = 0;
	["title", "description", "image", "site_name"].forEach(key=>{
		con[key] = $(`meta[property="og:${key}"]`).attr("content");
		if (con[key]) {
			n++;
			con[key] = con[key].slice(0, 2000);
		}
	});
	return n ? con : null;
}

// read information following in standard html tags
function readBasic($){
	let con = {};
	let n = 0;
	con.title = $("title").text();
	if (con.title) {
		n++;
		con.title = con.title.slice(0, 1000);
	}
	con.description = $(`meta[name="description"]`).attr("content");
	if (con.description) {
		n++;
		con.description = con.description.slice(0, 1000);
	}
	return n ? con : null;
}

