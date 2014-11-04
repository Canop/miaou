var	buster = require("buster"),
	tribo = require('../../plugins/ludogene/client-scripts/Tribo.js');

buster.testCase("Tribo", {
    "encode/decode move": function () {
		[0,1].forEach(function(player){
			for (var x=0; x<10; x++) {
				for (var y=0; y<10; y++) {
					var m1 = {p:player, x:x, y:y};
					var c = tribo.encodeMove(m1);
					var m2 = tribo.decodeMove(c);
					buster.assert.equals(m1.p, m2.p);
					buster.assert.equals(m1.x, m2.x);
					buster.assert.equals(m1.y, m2.y);
				}
			}
		});
	}
});
