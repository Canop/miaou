const lib = require('../../libs/db.js');

test("prepared statement composition", ()=>{
	let sql = "select * from message";
	let conditions = [];
	conditions.push("to_tsvector($1, content) @@ plainto_tsquery($1,$2)");
	conditions.push("room=$1");
	conditions.push("author=$1");
	conditions.push("truc is null");
	conditions.push("field1=$2 or (field2=$1 and field3=$2)");
	let postConditions = "order by message.id desc limit $1 offset $2";
	let expected = "select * from message where (to_tsvector($1, content) @@ plainto_tsquery($1,$2)) and (room=$3)"+
		" and (author=$4) and (truc is null) and (field1=$6 or (field2=$5 and field3=$6))"+
		" order by message.id desc limit $7 offset $8";
	expect(lib.ps(sql, conditions, postConditions)).toBe(expected);
});
