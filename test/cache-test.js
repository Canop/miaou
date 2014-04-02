var buster = require("buster"),
	cache = require('../libs/cache.js');

buster.testCase("cache", {
    "set/get/del, overflow": function () {
		var c = cache(3)
		buster.assert.equals(c.size(), 0);
		c.set('0', 'zero')
		c.set('a', 'A');
		c.set('b', 'B'); // -> keys : 0, a, b
		buster.assert.equals(c.pick('0'), 'zero');
		buster.assert.equals(c.size(), 3);
		c.set('a', 'a'); // -> keys : 0, a, b (a value change doesn't count as an access)
		c.set('onetoomany', null); // -> keys : a, b, onetoomany
		buster.assert.equals(c.pick('0'), undefined);
		buster.assert.equals(c.pick('a'), 'a');
		c.get('a'); // -> keys : b, onetoomany, a
		c.set('d','d'); // -> keys : onetoomany, a, d
		buster.assert.equals(c.pick('b'), undefined);
		buster.assert.equals(c.pick('a'), 'a');
		buster.assert.equals(c.size(), 3);
		c.del('a'); // -> keys : onetoomany, d
		c.del('nothere');
		buster.assert.equals(c.size(), 2);
		buster.assert.equals(c.pick('onetoomany'), null);
		buster.assert.equals(c.pick('a'), undefined);
		buster.assert.equals(c.pick('d'), 'd');
		c.empty();
		buster.assert.equals(c.size(), 0);
    }
});
