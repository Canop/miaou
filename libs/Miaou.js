// The Miaou class should have only one instance
// It's provided to plugins and serves as proxy to access
// libs, sockets, etc.

const	path = require('path');

class Miaou{

	constructor(config, db){
		this.bot = null;
		this.db = db;
		this.config = config;
	}

	// return a component of miaou (in /libs) whatever the path
	//  of the calling code (so that plugins don't have to know
	//  their path relative to miaou)
	lib(name){
		return module.require("./"+name+".js");
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

	// return a promise
	initBot(){
		var	miaou = this,
			botAvatar = this.conf("botAvatar");
		return this.db.on("miaou")
		.then(this.db.getBot)
		.then(function(b){
			miaou.bot = b;
			if (botAvatar.src!==b.avatarsrc || botAvatar.key!==b.avatarkey) {
				b.avatarsrc = botAvatar.src;
				b.avatarkey = botAvatar.key;
				return this.updateUser(b);
			}
		})
		.finally(this.db.off);
	}

	// returns a promise
	async initPlugins(){
		this.plugins = [];
		var files = this.conf("plugins");
		for (var i=0; i<files.length; i++) {
			try {
				var	file = files[i],
					pluginfilepath = path.resolve(__dirname, '..', file),
					plugin = require(pluginfilepath);
				if (plugin.init) await plugin.init(this);
				this.plugins.push(plugin);
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
