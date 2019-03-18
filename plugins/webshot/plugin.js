const phantom = require('phantom');
const WIDTH = 1400;
const HEIGHT = 1000;

exports.name = "webshot";

let storeImage;

exports.init = function(miaou){
	storeImage = miaou.lib("upload").storeImage;
}

async function onCommand(ct){
	const urlMatch = ct.args.match(/\bhttps?:\/\/\S+/);
	if (!urlMatch) throw new Error("This command needs an URL as argument");
	const url = urlMatch[0];
	console.log('!!webshot url:', url);
	let width = WIDTH;
	let height = HEIGHT;
	const sizeMatch = ct.args.match(/\b(\d+)\s*(?:x|\*)\s*(\d+)\b/);
	if (sizeMatch) {
		width = sizeMatch[1];
		height = sizeMatch[2];
		if (width<10) throw new Error("invalid width");
		if (height<10) throw new Error("invalid height");
		if (height*width>3000*2000) throw new Error("requested size too big");
	}
	const instance = await phantom.create();
	try {
		const page = await instance.createPage();
		await page.property('viewportSize', {width, height});
		const status = await page.open(url);
		console.log('status:', status);
		if (status=="fail") {
			throw new Error("URL fetching failed");
		}
		let image = {
			bytes: await page.renderBase64("png"),
			uploader: ct.shoe.publicUser.id,
			ext: 'png'
		};
		let data = await storeImage(image);
		if (!data.url) { // should not happen, I think (because handled in "upload" lib)
			if (data.error) {
				throw new Error("Imgur sent an error: " + data.error);
			} else {
				throw new Error("Something failed"); // should not happen because handled in
			}
		}
		//ct.reply(`Screenshot of ${url} :\n${data.link}`);
		ct.reply(data.url);
	} finally {
		await instance.exit();
	}
	ct.end();
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name:'webshot',
		fun:onCommand,
		help:"takes a screenshot of a website. Example: `!!webshot https://dystroy.org`",
		detailedHelp:"You can also precise the dimension of the virtual browser:"
			+ "\n* `!!!!webshot https://dystroy.org 200x3000`"
	});
}

