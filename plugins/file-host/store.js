// storage and utilities for the file-host plugin
const	path = require("path"),
	fs = require("fs").promises,
	crypto = require('crypto');

var	db,
	appUtils,
	auths,
	baseDirectory,
	maxSize,
	rateLimitSumSize,
	rateLimitNumber,
	rateLimitPeriod,
	lastId = 0;

exports.init = async function(miaou, plugin){
	appUtils = miaou.lib("app-utils");
	auths = miaou.lib("auths");
	db = miaou.db;
	await db.upgrade(plugin.name, path.resolve(__dirname, 'sql'));
	baseDirectory = miaou.conf("pluginConfig", "file-host", "base-directory");
	maxSize = miaou.conf("pluginConfig", "file-host", "max-size") || (100*1024);
	rateLimitSumSize = miaou.conf("pluginConfig", "file-host", "rate-limit", "sum-size") || (2*1024*1024);
	rateLimitNumber = miaou.conf("pluginConfig", "file-host", "rate-limit", "number") || (1000);
	rateLimitPeriod = miaou.conf("pluginConfig", "file-host", "rate-limit", "period") || (24*60*60*1000);
	if (!baseDirectory) throw new Error("No base-directory configured for file-host plugin");
	fs.mkdir(baseDirectory, {recursive: true});
}

// returns the directory and filename for a given (hash, extension)
exports.pathPartsForHash = function(hexHash, ext){
	let [, dir1, dir2] = hexHash.match(/^(.{2})(.{2})/);
	let dir = path.join(baseDirectory, dir1, dir2);
	let name = `${hexHash}.${ext}`;
	return {
		dir,
		name,
		file: path.join(dir, name)
	};
}

let urlForHash = exports.urlForHash = function(hexHash, ext){
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

exports.fileById = async function(con, id){
	return await con.queryRow(
		"select id, size, hash, ext, uploader from hosted_file where id=$1",
		[+id],
		"file-host / file-by-id"
	);
}

exports.filesByHash = async function(con, hash, ext){
	return await con.queryRows(
		"select id, size, hash, ext, uploader from hosted_file where hash=$1 and ext=$2",
		[hash, ext],
		"file-host / files-by-hash"
	);
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
	if (!auths.isServerAdmin({id:uploader})) {
		let ru = await recentUploads(uploader, rateLimitPeriod);
		if (ru.number > rateLimitNumber) {
			throw new Error("Too many recent uploads");
		}
		if (ru.sumsize > rateLimitSumSize) {
			throw new Error("Sum of recent upload sizes is too big");
		}
	}
	let id = newId();
	let hasher = crypto.createHash('sha1');
	hasher.update(bytes);
	let hash = hasher.digest().slice(0, 12); // byte buffer
	let hexHash = hash.toString('hex');
	let pathParts = exports.pathPartsForHash(hexHash, ext);
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

// TODO delete empty directories
exports.deleteFileFromDisk = async function(hexHash, ext){
	let filepath = exports.pathPartsForHash(hexHash, ext).file;
	fs.unlink(filepath, function(err){
		console.log("file deleted on disk:", filepath);
		if (err) {
			console.err(err);
		}
	});
}
