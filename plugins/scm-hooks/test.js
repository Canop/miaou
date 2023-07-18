
// build a simulated SCM request, to be used in scmCalling
function simulate(ct, provider, args){
	args = args.split(' ');
	console.log("scm-hook SIMULATE", args);
	if (args.length < 2) {
		ct.reply("Missing simulation arguments", true);
		return;
	}
	let subcommand = args.shift();
	if (subcommand == "star") {
		return simulate_star(ct, provider, args);
	} else {
		ct.reply("unknown simulation subcommand", true);
	}
}

// args should be [starrer, repo]
function simulate_star(ct, provider, args){
	if (args.length < 2) {
		ct.reply("not enough argumens: starring needs a starrer and a repo", true);
		return;
	}
	let [starrer, repository_name] = args;
	let headers = { 'x-github-event': "watch" };
	let body = {
		sender: { name: starrer },
		repository:{full_name: repository_name, name: repository_name},
	};
	return { headers, body };
}

exports.simulate = simulate;
