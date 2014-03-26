// a simple in memory cache throwing the least recently accessed entry when
//  the maximal number of entries is reached.
// All set/get operations are O(1) and synchronous.
//
// Keys are strings. Values are what you want (null allowed).
//
// Initialization :
//    var cache = require('cache.js')(30); // 30 is the capacity
//
// Methods :
//  set(key, value) : sets a pair (key,value). If the key wasn't in the cache,
//                    it's considered to be the most recently accessed. If the
//                    cache is full, the least recently (key,value) is removed.
//  get(key)        : returns the value. The pair (key,value) is considered to
//                    be the most recently accessed. If nothing was set for this
//                    key, returns undefined.
//  pick(key)       : same as get without accessing the pair (and thus not
//                    preventing a removal from the cache.
//  del(key)        : removes the pair (key,value). Returns the value.
//  size()          : returns the number of cached keys, in [0, capacity].
//  content()       : returns all pairs (key,value), from the oldest to the
//                    last recently accessed

module.exports = function(capacity){
	var n = 0, cap = capacity||100,
		first = null, last = null,
		map = {};
	return {
		set: function(k,v){
			var c = map[k];
			if (c) { // a value change doesn't count as an access
				c.v = v;
				return;
			}
			if (n>=cap) {
				delete map[first.k];
				first = first.n;
				first.p = null;
			} else {
				n++;
			}
			c = {k:k, v:v, p:last};
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
				else first = c.n;
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
		del: function(k){
			var c = map[k];
			if (!c) return;
			if (c.p) c.p.n = c.n;
			else first = c.n;
			if (c.n) c.n.p = c.p;
			else last = c.p;
			n--;
			delete map[k];
			return c.v;
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
		},
		empty: function(){
			first = null;
			last = null;
			map = {};
			n = 0;
		}
	}
}
