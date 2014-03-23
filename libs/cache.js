// a simple cache, optimized for big numbers of keys (all operations are O(1)).
//
// Initialization :
//    var cache = require('cache.js')(30); // 30 is the capacity
// 
// set(key, value) : sets a pair (key,value). If the key wasn't in the cache,
//                   it's considered to be the most recently accessed. If the
//                   cache is full, the least recently (key,value) is removed.
// get(key)        : returns the value. The pair (key,value) is considered to
//                   be the most recently accessed.
// pick(key)       : same as get without accessing the pair (and thus not
//                   preventing a removal from the cache.
// size()          : returns the number of cached keys, in [0, capacity].
// content()       : returns all pairs (key,value), from the oldest to the
//                   last recently accessed

module.exports = function(opts){
	var n = 0, capacity = 100,
		first = null, last = null,
		map = {};
	if (typeof opts === 'number') capacity = opts;
	else if (typeof opts === 'object' && opts.capacity) capacity = opts.capacity;
	return {
		set: function(k,v){
			var c = map[k];
			if (c) { // a value change doesn't count as an access
				c.v = v;
				return;
			}
			if (n>=capacity) {
				delete map[first.k];
				first = first.n;
				first.p = null;
			} else {
				n++;
			}
			var c = {k:k, v:v, p:last};
			if (last) last.n = c;
			else first = c;
			last = c;
			map[k] = c;
		},
		get: function(k){
			var c = map[k];
			if (!c) return;
			if (c!=last) {
				if (c.p) c.p.n = c.n;
				else first = c.n 
				c.n.p = c.p;
				last.n = c;
				c.p = last;
				last = c;
			}			
			return c.v;
		},
		pick: function(k){
			var c = map[k];
			return c ? c.v : undefined;
		},
		size: function(){
			return n;
		},
		content: function(){
			var c = first, a = [];
			while (c) {
				a.push({key:c.k, value:c.v});
				c = c.n;
			}
			return a;
		}
	}
}
