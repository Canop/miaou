let fmt;
let store;

exports.init = async function(miaou, plugin){
	fmt = miaou.lib("fmt");
	store = plugin.store;
}

// !!filehost list
exports.doCommand = async function(con, ct, args){
	let files = await con.queryRows(
		"select id, size, hash, ext from hosted_file where uploader=$1",
		[ct.user().id],
		"file-host / user-list"
	);
	if (files.length==0) {
		ct.reply("You don't have any file stored on this server.");
	} else {
		let c = `You have ${files.length} files stored on this server:\n`;
		c += "#filehost-list\n"; // pragma for client-side rendering
		c += fmt.tbl({
			cols: ["id", "url", "size"],
			rows: files.map(function(f){
				let hexHash = f.hash.toString('hex');
				return [
					f.id,
					store.urlForHash(hexHash, f.ext),
					fmt.bytes(f.size, 2)
				];
			})
		});
		ct.reply(c, ct.nostore = true);
	}
	ct.end("list");
}
