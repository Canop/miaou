
// buids the #graph pragma which can be inserted in a message (before the related table)
// Knonw options:
//	hideTable: if true the data table will be hidden
//	nox: if true there will be no x labels
//	compare: use the same y ratio for all columns
//	highlight-x: specify the column(s) to highlight
//	xcol: the index of the column to choose for x
//	ycols: an array of the index of columns to display (if autoselect isn't ok)
// It's recommanded to use this function to write the pragma as the
//  format isn't yet finalized.
exports.pragma = function(options={}){
	return `#graph(${Object.keys(options).map(k=>{
		var v = options[k];
		if (Array.isArray(v)) v = v.join(" ");
		if (v===false || v===undefined) return;
		if (v===true) return k;
		return `${k}:${v}`;
	}).filter(Boolean).join(",")})\n`;
}
