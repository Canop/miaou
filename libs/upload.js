
var	bench = require('./bench.js'),
	request = require('request'),
	clientID,
	Busboy = require('busboy');

exports.configure = function(miaou){
	clientID = miaou.conf("imgur", "clientID");
	return this;
}

exports.appPostUpload = function(req, res){
	if (!clientID) {
		console.log(
			'To activate the imgur service, register your application'
			+ ' at imgur.com and set the imgur.clientID property in the config.json file.'
		);
		return res.send({error:"upload service not available"}); // todo : don't show upload button in this case
	}
	var	busboy = new Busboy({ headers: req.headers }),
		files=[];
	console.log("receiving upload task...");
	busboy
	.on('field', function(fieldname, dataUrl, fieldnameTruncated, valTruncated, encoding, mimetype){
		var buffer = new Buffer(dataUrl.split(",")[1], 'base64');
		files.push({name:fieldname, bytes:buffer});
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
	.on('finish', function(){
		if (!files.length) {
			return res.send({error:'found nothing in form'});
		}
		var	bo = bench.start("Image Upload / to imgur");
		// for now, we handle only the first file, we'll see later if we want to upload galleries
		console.log('Trying to send image of '+ files[0].bytes.length +' bytes to imgur');
		var options = {
			url: 'https://api.imgur.com/3/upload',
			headers: { Authorization: 'Client-ID ' + clientID }
		};
		var r = request.post(options, function(err, req, body){
			if (err) {
				console.log('Error while uploading to imgur', err);
				return res.send({error:'Error while uploading to imgur'});
			}
			if (!body || !body.length) {
				return res.send({error: "Empty answer from imgur"});
			}
			var data = {error:'imgur answer parsing'};
			try {
				data = JSON.parse(body).data;
			} catch (e) {
				console.log("Error while parsing imgur answer:", e);
				console.log(body);
				return res.send({error: "Invalid JSON in imgur's answer"});
			}
			if (data && data.error) return res.send({error:"imgur answered : "+data.error});
			if (!data || !data.id) return res.send({error:"Miaou didn't understand imgur's answer"});
			bo.end(); // we don't count failed uploads
			res.send({image:data});
		})
		var form = r.form();
		form.append('type', 'file');
		form.append('image', files[0].bytes);
	});
	req.pipe(busboy);
}
