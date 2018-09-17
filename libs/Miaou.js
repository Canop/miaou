// The Miaou class should have only one instance
// It's provided to plugins and serves as proxy to access
// libs, sockets, etc.

const	path = require('path'),
	bots = require("./bots.js");

class Miaou{

	constructor(config, db){
		this.bot = null;
		this.db = db;
		this.config = config;
		this.startTime = Date.now()/1000|0;
	}

	// return a component of miaou (in /libs) whatever the path
	//  of the calling code (so that plugins don't have to know
	//  their path relative to miaou)
	lib(name){
		let lib = module.require("./"+name+".js");
		if (lib.configure && !lib.configured) {
			lib.configure(this);
			lib.configured = true;
		}
		return lib;
	}

	// return an already configured plugin, if available
	plugin(name){
		return this.plugins.find(p => p.name===name);
	}

	// return a config element by path, undefined if missing
	// example:
	//   var timeout = miaou.conf("deep", "config", "timeout") || 0;
	conf(...token){
		return token.reduce((o, t)=> o ? o[t] : undefined, this.config);
	}

	async initBot(){
		var	miaou = this,
			botAvatar = this.conf("botAvatar");
		await miaou.db.do(async function(con){
			let b = await con.getBot("miaou");
			miaou.bot = b;
			bots.register(b);
			if (botAvatar.src!==b.avatarsrc || botAvatar.key!==b.avatarkey) {
				b.avatarsrc = botAvatar.src;
				b.avatarkey = botAvatar.key;
				await con.updateUser(b);
			}
		});
	}

	// returns a promise
	async initPlugins(){
		this.plugins = [];
		var files = this.conf("plugins");
		for (var i=0; i<files.length; i++) {
			try {
				var	file = files[i],
					start = Date.now(),
					pluginfilepath = path.resolve(__dirname, '..', file),
					plugin = require(pluginfilepath);
				if (plugin.init) await plugin.init(this);
				if (!plugin.name) plugin.name = file.match(/([^\/]+)\/[^\/]*$/)[1];
				this.plugins.push(plugin);
				console.log(`Init of plugin ${file} took ${Date.now()-start} ms`);
			} catch (err) {
				console.log("Error in plugin initialization");
				console.error(err);
			}
		}
	}

	// returns a promise
	requestTag(tag){
		return this.db.on(tag.name)
		.then(this.db.getTag)
		.then(function(existingTag){
			if (!existingTag) return this.createTag(tag.name, tag.description);
		})
		.finally(this.db.off);
	}
}

module.exports = function(config, db){
	return new Miaou(config, db);
}
