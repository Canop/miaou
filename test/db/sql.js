var	buster = require("buster"),
	lib = require('../../libs/db.js');

// the purpose of that test case is to check the proper numbering of prepared
//  statements arguments
buster.testCase("sql", {
	"ps building": function(){
		console.log(Object.keys(lib));
		var conditions = [];
		var sql = "select * from message";
		conditions.push("to_tsvector($1, content) @@ plainto_tsquery($1,$2)");
		conditions.push("room=$1");
		conditions.push("author=$1");
		conditions.push("truc is null");
		conditions.push("field1=$2 or (field2=$1 and field3=$2)");
		var postConditions = "order by message.id desc limit $1 offset $2";
		var expected = "select * from message where (to_tsvector($1, content) @@ plainto_tsquery($1,$2)) and (room=$3)"+
		" and (author=$4) and (truc is null) and (field1=$6 or (field2=$5 and field3=$6)) order by message.id desc limit $7 offset $8";
		buster.assert.equals(lib.ps(sql, conditions, postConditions), expected);
	}
});

