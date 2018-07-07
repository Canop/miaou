const tribo = require('../../plugins/ludogene/client-scripts/Tribo.js');

describe("Tribo", ()=>{
	test("encode/decode move", function () {
		[0,1].forEach(function(player){
			for (var x=0; x<10; x++) {
				for (var y=0; y<10; y++) {
					var m1 = {p:player, x:x, y:y};
					var c = tribo.encodeMove(m1);
					var m2 = tribo.decodeMove(c);
					expect(m1.p).toBe(m2.p);
					expect(m1.x).toBe(m2.x);
					expect(m1.y).toBe(m2.y);
				}
			}
		});
	});
});
