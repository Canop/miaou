// an alternative to $.fn.data
// It looks like it works better
(function(){
	var datCache = new WeakMap;
	$.fn.dat = function(key, val){
		if (this.length===0) return arguments.length===1 ? undefined : this;
		if (this.length>1) {
			console.log('Warning: $.fn.dat called on a collection with several elements', this);
		}
		var oc = datCache.get(this.get(0));
		if (!oc) {
			oc = new Map;
			datCache.set(this.get(0), oc);
		}
		if (arguments.length===1) {
			return oc.get(key);
		} else {
			oc.set(key, val);
			return this;
		}
	}
})();
