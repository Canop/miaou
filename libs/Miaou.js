// The Miaou class should have only one instance
// It's provided to plugins and serves as proxy to access
// libs, sockets, etc.

const	path = require('path'),
	Promise = require('bluebird');

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

	// returns a config element by path, undefined if missing
	// example:
	//   var timeout = miaou.conf("deep", "config", "timeout") || 0;
	conf(...token){
		return token.reduce((o, t)=> o ? o[t] : undefined, this.config);
	}

	// returns a promise
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
	initPlugins(){
		this.plugins = [];
		return Promise.all(this.conf("plugins").reverse().map(n => {
			try {
				var	pluginfilepath = path.resolve(__dirname, '..', n),
					plugin = require(pluginfilepath),
					init = plugin.init ? plugin.init(this) : null;
				return Promise.resolve(init)
				.then(()=>{
					this.plugins.push(plugin);
				})
			} catch (e) {
				console.log("ERRR:", e);
			}
		}))
		.catch(err=>{
			console.log("Error in plugin initialization");
			console.error(err);
		});
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
