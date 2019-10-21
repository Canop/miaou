// handles the !!filehost delete command
let store;

exports.init = async function(miaou, plugin){
	store = plugin.store;
}

// !!filehost delete 123456
exports.doCommand = async function(con, ct, args){
	let id = + args;
	console.log(`FileHost: @${ct.user().name} asks to delete file ${id}`);
	if (!id) {
		throw new Error("File id not sent");
	}
	let file = await store.fileById(con, id);
	if (!file) {
		throw new Error(`File ${id} not found`);
	}
	if (file.uploader != ct.user().id) {
		throw new Error("This file seems to belong to somebody's else");
	}
	console.log("file to delete:", file); // keep this log for inquiries
	await con.execute(
		"delete from hosted_file where id=$1",
		[id],
		"file-host / delete"
	);
	let files = await store.filesByHash(con, file.hash, file.ext);
	if (files.length==0) {
		let hexHash = file.hash.toString('hex');
		store.deleteFileFromDisk(hexHash, file.ext);
	} else {
		console.log('other records with same hash and ext:', files);
		console.log(" -> no file deleted on disk");
	}
	ct.reply("OK");
	ct.end("delete");
}

