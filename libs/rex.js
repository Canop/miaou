// regular expression utility using template literals
//
// Simple Example:
//
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
	.replace(/\s*(\/\/.*)?$\s*/gm, "") // remove comments and spaces at both ends of lines
	.match(/^\/?(.*?)(?:\/(\w+))?$/); // extracts source and flags
	return new RegExp(source, flags);
}

