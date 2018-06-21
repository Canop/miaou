
// a command to create, edit, or delete a tag

const	auths = require('./auths.js');

exports.configure = function(miaou){
	return this;
}

function asCode(description){
	return description.split("\n").map(line => "\t"+line).join("\n");
}

function doCommand(ct){
	var m = ct.args.match(/^\s*(delete )?([A-Za-zÀ-ÿ0-9-]{3,50})$/);
	if (!m) throw new Error("invalid command call or invalid tag");
	var isDelete = !!m[1];
	if (isDelete) throw new Error("Only a master can delete a tag");
	var	name = m[2],
		description = ct.message.content.replace(/^.*?(\n|$)/, '').trim();
	return this.getTag(name).then((tag)=>{
		if (tag) {
			if (description) {
				// modification of the description of an existing tag
				if (!auths.isServerAdmin(ct.shoe.completeUser)) {
					throw "Only a server admin can create or delete a tag";
				}
				return this.updateTag(name, description).then(()=>{
					ct.reply(
						"Tag " + name + " updated.\n"+
						"## Old Description:\n"+
						asCode(tag.description)+"\n"+
						"## New Description:\n"+
						asCode(description)
					);
				});
			} else {
				// consultation of the description of an existing tag
				ct.reply(
					"Tag " + name + ":\n"+
					asCode(tag.description)
				);
			}
		} else {
			if (!auths.isServerAdmin(ct.shoe.completeUser)) {
				throw "Only a server admin can create or delete a tag";
			}
			if (description) {
				// creation of a new tag
				return this.createTag(name, description).then(()=>{
					ct.reply(
						"New Tag " + name + ":\n"+
						asCode(description)
					);
				});
			} else {
				throw new Error ("A new tag need a description");
			}
		}
		ct.end();
	});
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name: 'tag',
		fun: doCommand,
		help: "create or delete a tag",
	});
}

