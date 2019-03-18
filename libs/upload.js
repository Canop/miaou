
var	bench = require('./bench.js'),
	request = require('request'),
	detectType = require('file-type'),
	imgurClientID,
	miaou,
	Busboy = require('busboy');

exports.configure = function(_miaou){
	miaou = _miaou;
	imgurClientID = miaou.conf("imgur", "clientID");
	return this;
}

exports.sendImageToImgur = function(bytes){
	throw new Error("removed function, use storeImage");
}

async function storeImageOnFileHost(fileHoster, image){
	let saved = await fileHoster.saveFile(image.ext, image.uploader, image.bytes);
	image.url = saved.url;
}

function storeImageOnImgur(image){
	return new Promise(function(resolve, reject){
		var	bo = bench.start("Image Upload / to imgur");
		console.log('Trying to save image of '+ image.bytes.length +' bytes to imgur');
		var options = {
			url: 'https://api.imgur.com/3/upload',
			headers: { Authorization: 'Client-ID ' + imgurClientID }
		};
		var r = request.post(options, function(err, req, body){
			if (err) {
				return reject(err);
			}
			if (!body || !body.length) {
				return reject(new Error("Empty answer from imgur"));
			}
			var data;
			try {
				data = JSON.parse(body).data;
			} catch (e) {
				console.log("Error while parsing imgur answer:", e);
				console.log(body);
				return reject(new Error("Invalid JSON in imgur's answer"));
			}
			console.log('data:', data);
			if (data && data.error) {
				return reject(new Error("imgur answered : "+data.error));
			}
			if (!data || !data.id) {
				return reject(new Error("imgur's answer makes no sense"));
			}
			bo.end(); // we don't count failed uploads
			resolve(data);
		})
		var form = r.form();
		form.append('type', 'file');
		form.append('image', image.bytes);
	});
}

// store the image using the available storage solution
// Takes an object {
// 	ext
// 	uploader
// 	bytes
// }
//
// adds the following fields: {
// 	id
// 	url
// }
exports.storeImage = async function(image){
	try {
		let fileHoster = miaou.plugin("file-host");
		if (fileHoster) {
			await storeImageOnFileHost(fileHoster, image);
		} else if (imgurClientID) {
			let imgurData = await storeImageOnImgur(image);
			image.url = imgurData.link;
		} else {
			console.log("Found no solution for image hosting");
			console.log(
				'To activate the imgur service, register your application'
				+ ' at imgur.com and set the imgur.clientID property in the config.json file.'
			);
			throw new Error("No configured File Hoster");
		}
	} catch (error) {
		image.error = error.toString();
		console.log("Error on upload: " + image.error);
	}
	return image;
}

exports.appPostUpload = function(req, res){
	var	busboy = new Busboy({ headers: req.headers }),
		files = [];
	console.log("receiving upload task...");
	busboy
	.on('field', function(fieldname, dataUrl, fieldnameTruncated, valTruncated, encoding, mimetype){
		var buffer = new Buffer(dataUrl.split(",")[1], 'base64');
		files.push({
			name:fieldname,
			bytes:buffer
		});
	})
	.on('file', function(fieldname, file){
		var	chunks = [],
			bo = bench.start("Image Upload / from browser");
		file.on('data', function(chunk){
			chunks.push(chunk);
			// todo : abort if sum of chunk.lengths is too big (and tell the client he's fat)
		});
		file.on('end', function(){
			files.push({name:fieldname, bytes:Buffer.concat(chunks)});
			bo.end();
		});
	})
	.on('finish', async function(){
		if (!files.length) {
			return res.send({error:'found nothing in form'});
		}
		// for now, we handle only the first file, we'll see later if we want to upload galleries
		let file = files[0];
		let type = detectType(file.bytes);
		let image = {
			bytes: file.bytes,
			ext: type.ext,
			uploader: req.user.id
		};
		await exports.storeImage(image);
		res.send({
			url: image.url,
			error: image.error,
		});
	});
	req.pipe(busboy);
}
