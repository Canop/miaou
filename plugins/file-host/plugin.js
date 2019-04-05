// let other plugins or core Miaou upload files
const	path = require("path"),
	fs = require("fs").promises,
	crypto = require('crypto');

var	db,
	appUtils,
	baseDirectory,
	maxSize,
	rateLimitSumSize,
	rateLimitNumber,
	rateLimitPeriod,
	allowUnloggedReaders,
	lastId = 0;

exports.name = "file-host";

exports.init = async function(miaou){
	appUtils = miaou.lib("app-utils");
	db = miaou.db;
	await db.upgrade(exports.name, path.resolve(__dirname, 'sql'));
	baseDirectory = miaou.conf("pluginConfig", "file-host", "base-directory");
	maxSize = miaou.conf("pluginConfig", "file-host", "max-size") || (100*1024);
	rateLimitSumSize = miaou.conf("pluginConfig", "file-host", "rate-limit", "sum-size") || (2*1024*1024);
	rateLimitNumber = miaou.conf("pluginConfig", "file-host", "rate-limit", "number") || (1000);
	rateLimitPeriod = miaou.conf("pluginConfig", "file-host", "rate-limit", "period") || (24*60*60*1000);
	allowUnloggedReaders = !!miaou.conf("pluginConfig", "file-host", "allow-unlogged-readers");
	if (!baseDirectory) throw new Error("No base-directory configured for file-host plugin");
	fs.mkdir(baseDirectory, {recursive: true});
	await require("./file-host-stats.js").init(miaou);
}

// returns the directory and filename for a given (hash, extension)
function pathPartsForHash(hexHash, ext){
	let [, dir1, dir2] = hexHash.match(/^(.{2})(.{2})/);
	let dir = path.join(baseDirectory, dir1, dir2);
	let name = `${hexHash}.${ext}`;
	return {
		dir,
		name,
		file: path.join(dir, name)
	};
}

function urlForHash(hexHash, ext){
	return appUtils.url(`/file-host/${hexHash}.${ext}`);
}

async function recentUploads(uploader, durationMillis){
	let since = Date.now()-durationMillis;
	return db.do(async function(con){
		return con.queryRow(
			"select count(id) nb, sum(size) sumSize from hosted_file where uploader=$1 and id>$2",
			[uploader, since],
			"file-host / recent-uploads"
		);
	});
}

function newId(){
	lastId = Math.max(lastId+1, Date.now());
	return lastId;
}

// save a file:
// - ext: file extension (ex: 'jpeg')
// - uploader: numerical id of a user
//
// If there's already an entry with the same hash (i.e. the content is "probably" the same)
// there's no writing on disk (but a record is still inserted in db)
exports.saveFile = async function(ext, uploader, bytes){
	if (bytes.length < 1 || bytes.length > maxSize) {
		throw new Error("Invalid file length: " + bytes.length);
	}
	let ru = await recentUploads(uploader, rateLimitPeriod);
	if (ru.number > rateLimitNumber) {
		throw new Error("Too many recent uploads");
	}
	if (ru.sumsize > rateLimitSumSize) {
		throw new Error("Sum of recent upload sizes is too big");
	}
	let id = newId();
	let hasher = crypto.createHash('sha1');
	hasher.update(bytes);
	let hash = hasher.digest().slice(0, 12); // byte buffer
	let hexHash = hash.toString('hex');
	let pathParts = pathPartsForHash(hexHash, ext);
	await fs.mkdir(pathParts.dir, {recursive:true});
	await fs.writeFile(path.join(pathParts.dir, pathParts.name), bytes);
	console.log("hosted file written : ", pathParts.name);
	await db.do(async function(con){
		await con.execute(
			"insert into hosted_file (id, uploader, size, ext, hash) values ($1, $2, $3, $4, $5)",
			[id, uploader, bytes.length, ext, hash],
			"file-host/insert"
		);
	});
	return {
		id,
		url: urlForHash(hexHash, ext)
	};
}

exports.registerRoutes = map=>{
	map("get", /^\/file-host\/([0-9a-f]{10,64})\.(\w+)$/, function(req, res, next){
		res.setHeader("Cache-Control", "public, max-age=360000"); // in seconds
		res.sendFile(pathPartsForHash(req.params[0], req.params[1]).file);
	}, allowUnloggedReaders, allowUnloggedReaders);
}
