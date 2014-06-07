// protects the user from CSRF attacks by
// - checking the referrer in POST requests
// - checking a secret session token in POST requests
// This implies that all modules must
// - do all actions on POST forms
// - insert in the forms a hidden parameter
// Example in a form in Jade :
//  input(type="hidden", name="secret", value=secret)

module.exports = function(req, res, next){
	var session = req.session;
	if (!session.secret) session.secret = (Math.random()*Math.pow(36,5)|0).toString(36);
	if (req.method==='POST' && req.param('secret')!==session.secret) {
		console.log('Anti-csrf rejects this form. Session :', session);
		res.send(403, "Your request can't be processed as it seems to be invalid");
		return;
	}
	res.locals.secret = session.secret;
	console.log(res.locals);
	next();
}


