// let other plugins or core Miaou upload files
const store = exports.store = require("./store");
const commands = ["info", "list", "delete"].reduce(function(m, name){
	m[name] = require(`./${name}-command`);
	return m;
}, Object.create(null));

var allowUnloggedReaders;

exports.name = "file-host";

exports.init = async function(miaou){
	allowUnloggedReaders = !!miaou.conf("pluginConfig", "file-host", "allow-unlogged-readers");
	await store.init(miaou, this);
	for (mod of Object.values(commands)) {
		await mod.init(miaou, this);
	}
	await require("./file-host-stats.js").init(miaou);
}

exports.saveFile = store.saveFile;

exports.registerRoutes = map=>{
	map("get", /^\/file-host\/([0-9a-f]{10,64})\.(\w+)$/, function(req, res, next){
		res.setHeader("Cache-Control", "public, max-age=360000"); // in seconds
		res.sendFile(store.pathPartsForHash(req.params[0], req.params[1]).file);
	}, allowUnloggedReaders, allowUnloggedReaders);
}

async function doCommand(ct){
	let [, cmd, args] = ct.args.match(/^(\w*)(?:\s+(.*))?$/);
	let mod = commands[cmd];
	if (!mod) throw new Error("command not understood");
	await mod.doCommand(this, ct, args);
}

exports.registerCommands = function(cb){
	cb({
		name: "filehost",
		fun: doCommand,
		canBePrivate: true,
		help: "do things with hosted files",
		detailedHelp: "Subcommands:\n"
			+ "* `!!filehost list`"
	});
}
