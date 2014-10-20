// protects the user from CSRF attacks by
// - checking the referrer in POST requests
// - checking a secret session token in POST requests
// This implies that all modules must
// - do all actions on POST forms (or on a socket)
// - send the POST request for a page with same URL
// - insert in the forms a hidden parameter :
//    input(type="hidden", name="secret", value=secret)

module.exports = function(options){

	var whitemap = {};
	if (options && options.whitelist) {
		options.whitelist.forEach(function(s){ whitemap[s]=1 })
	}
		
	return function(req, res, next){
		var session = req.session;
		if (!session.secret) session.secret = (Math.random()*Math.pow(36,5)|0).toString(36);
		if (req.method==='POST' && !whitemap[req.path]) {
			var refererHost = (req.headers.referer||'').match(/^https?:\/\/([^\/\:]+)/)[1];
			if (req.param('secret')!==session.secret || refererHost!=req.hostname) {
				console.log('Anti-csrf rejects this form');
				console.log('req.host:', req.hostname);
				console.log('referer:', req.headers.referer);
				console.log('Session:', session);
				res.send(403, "There was a security problem, this request can't be processed.");
				return;
			}
		}
		res.locals.secret = session.secret;
		next();
	}
}

