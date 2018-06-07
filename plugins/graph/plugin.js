
// buids the #graph pragma which can be inserted in a message (before the related table)
exports.pragma = function(options={}){
	return `#graph(${Object.keys(options).map(k=>{
		var v = options[k];
		if (v===false || v===undefined) return;
		if (v===true) return k;
		return `${k}:${v}`;
	}).filter(Boolean).join(",")})\n`;
}
