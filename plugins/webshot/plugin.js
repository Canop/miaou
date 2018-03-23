const phantom = require('phantom');
const WIDTH = 1400;
const HEIGHT = 1000;

exports.name = "webshot";

let sendToImgur;
let bench;

exports.init = function(miaou){
	sendToImgur = miaou.lib("upload").sendImageToImgur;
	bench = miaou.lib("bench");
}

async function onCommand(ct){
	const match = ct.args.match(/https?:\/\/\S+/);
	if (!match) throw new Error("This command needs an URL as argument");
	let bo = bench.start("webshot");
	const url = match[0];
	console.log('url:', url);
	const instance = await phantom.create();
	const page = await instance.createPage();
	await page.property('viewportSize', { width: WIDTH, height: HEIGHT });
	const status = await page.open(url);
	console.log('status:', status);
	let b64 = await page.renderBase64("png");
	await instance.exit();
	let data = await sendToImgur(b64);
	console.log('data:', data);
	if (!data.link) { // should not happen, I think (because handled in upload.js
		if (data.error) {
			throw new Error("Imgur sent an error: " + data.error);
		} else {
			throw new Error("Something failed"); // should not happen because handled in
		}
	}
	bo.end();
	ct.reply(`Screenshot of ${url} :\n${data.link}`);
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name:'webshot',
		fun:onCommand,
		help:"takes a screenshot of a website. Example: `!!webshot https://dystroy.org`"
	});
}

