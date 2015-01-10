var	db,
	path = require('path');

function onCommand(ct){
	var	m = ct.message,
		lines = m.content.split('\n'),
		itemlines = lines.filter(function(l){ return /^(\d+\.|\*)\s+/.test(l) })
	console.log("lines:", lines);
	if (!itemlines.length) throw 'Nothing asked';
}

// handles the message by which a user votes
function wsvote(shoe, userdata){
	console.log('wsvote', userdata);
	var mid = userdata.mid;
	// FIXME check in query the user has access to the room
	db.on()
	.then(function(){
		return this.execute(
			"delete from survey_vote where message=$1 and player=$2",
			[mid, shoe.completeUser.id]
		);			
	})
	.then(function(){
		console.log("deleted");
		if (userdata.vote >= 0) {
			return this.execute(
				"insert into survey_vote (message, player, item) values ($1, $2, $3)",
				[mid, shoe.completeUser.id, userdata.vote]
			);			
		}
	})
	.then(function(){
		return this.queryRows(
			"select item, count(*) nb from survey_vote where message=$1 group by item", [mid]
		);
	})
	.then(function(rows){
		var data = {mid:mid, votes:{}};
		rows.forEach(function(row){
			data.votes[row.item] = row.nb;
		});
		shoe.emitToRoom('survey.votes', data);
	})
	.finally(db.off);
}

// handles messages querying votes
function wsvotes(shoe, mid){
	console.log('wsvotes', mid);
	var data = {mid:mid};
	db.on()
	.then(function(){
		return this.queryRow(
			"select item from survey_vote where message=$1 and player=$2", [mid, shoe.completeUser.id], true
		);
	})
	.then(function(row){
		console.log('ROW:', row);
		data.vote = row ? row.item : -1;
		return this.queryRows(
			"select item, count(*) nb from survey_vote where message=$1 group by item", [mid]
		);
	})
	.then(function(rows){
		console.log('ROWS:', rows);
		data.votes = {};
		rows.forEach(function(row){
			data.votes[row.item] = row.nb;
		});
		shoe.emit('survey.votes', data);
	})
	.finally(db.off);
}

exports.onNewShoe = function(shoe){
	shoe.socket
	.on('survey.vote', function(arg){ wsvote(shoe, arg) })
	.on('survey.votes', function(arg){ wsvotes(shoe, arg) })
}

exports.onChangeMessage = function(shoe, m){
	// what could we do to prevent cheating ?
}

exports.registerCommands = function(cb){
	cb({
		name:'survey', fun:onCommand,
		help:"starts a survey. Type `!!help !!survey` for detailed information"
	});
}


exports.init = function(miaou, pluginpath){
	db = miaou.db;
	db.upgrade('survey', path.resolve(pluginpath, 'sql'));
}
