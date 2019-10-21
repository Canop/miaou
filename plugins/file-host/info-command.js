// handles the !!filehost info command
let fmt;
let store;

exports.init = async function(miaou, plugin){
	fmt = miaou.lib("fmt");
	store = plugin.store;
}

// !!filehost info 123456
exports.doCommand = async function(con, ct, args){
	let id = + args;
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
	let hexHash = file.hash.toString('hex');
	let url = store.urlForHash(hexHash, file.ext);
	let c = `Info of file **${id}**\n`;
	c += `Size: ${fmt.bytes(file.size)}\n`;
	c += "URL: `" + url + "`\n";
	c += `Uploaded: ${fmt.date(id/1000|0)}\n`;
	let messages = await con.queryRows(
		"select id, room from message where author=$2 and content ~ $1",
		[hexHash, ct.user().id],
		"file-host / messages-by-file-hash"
	);
	if (messages.length==0) {
		c += "No message seem to refer to this file\n";
	} else {
		c += `You mention this file in ${fmt.oxford(messages.map(fmt.messageLink))}\n`;
	}
	c += `#filehost-delete(${id})\n\n`; // pragma adding a delete button client side
	c += url;
	ct.reply(c, ct.nostore = c.length>800);
	ct.end("info");
}
