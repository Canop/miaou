// regular expression utility
//
// Simple Exemple:
//	const regex = rex`
//		^	  // start of string
//		[a-z]+	  // some letters
//		bla(\d+)
//		$	  // end
//		/ig`;
//
//	console.log(regex); // /^[a-z]+bla(\d+)$/ig
//	console.log("Totobla58".match(regex)); // [ 'Totobla58' ]

module.exports = function(tmpl){
	let [, source, flags] = tmpl.raw.toString()
	.split(/\s*\n\s*/)
	.map(l => l.match(/^(.+?)( \/\/.*)?$/))
	.filter(Boolean)
	.map(m => m[1])
	.join("")
	.match(/^\/?(.*?)(?:\/(\w+))?$/);
	return new RegExp(source, flags);
}

