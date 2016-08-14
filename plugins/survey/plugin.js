var	db,
	path = require('path');

function onCommand(ct){
	var	m = ct.message,
		lines = m.content.split('\n'),
		itemlines = lines.filter(l=> /^(\d+\.|\*)\s+/.test(l));
	if (!itemlines.length) throw 'Nothing asked';
}

// handles the message by which a user votes
function wsvote(shoe, userdata){
	var mid = userdata.mid;
	// FIXME check in query the user has access to the room
	db.on()
	.then(function(){
		return this.execute(
			"delete from survey_vote where message=$1 and player=$2",
			[mid, shoe.completeUser.id],
			"survey / remove_vote"
		);
	})
	.then(function(){
		if (userdata.vote >= 0) {
			return this.execute(
				"insert into survey_vote (message, player, item) values ($1, $2, $3)",
				[mid, shoe.completeUser.id, userdata.vote],
				"survey / insert_vote"
			);
		}
	})
	.then(function(){
		return this.queryRows(
			"select item, count(*) nb from survey_vote where message=$1 group by item",
			[mid],
			"survey / list_votes"
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
	var data = {mid:mid};
	db.on()
	.then(function(){
		return this.queryOptionalRow(
			"select item from survey_vote where message=$1 and player=$2",
			[mid, shoe.completeUser.id],
			"survey / user vote"
		);
	})
	.then(function(row){
		data.vote = row ? row.item : -1;
		return this.queryRows(
			"select item, count(*) nb from survey_vote where message=$1 group by item",
			[mid],
			"survey / list_votes"
		);
	})
	.then(function(rows){
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
	.on('survey.vote', function(arg){
		wsvote(shoe, arg)
	})
	.on('survey.votes', function(arg){
		wsvotes(shoe, arg)
	})
}

exports.onReceiveMessage = function(shoe, m){
	// what could we do to prevent cheating ?
}

exports.registerCommands = function(cb){
	cb({
		name:'survey', fun:onCommand,
		help:"starts a survey. Type `!!help !!survey` for detailed information",
		detailedHelp: "Example:"
			+"\n#lang-md"
			+ "\n    !!survey What's your favorite colour?"
			+ "\n    * Red"
			+ "\n    * Dark Red"
			+ "\n    * Light Red"
			+ "\n    * Purple"
			+ "\n    * Octarine"
	});
}


exports.init = function(miaou){
	db = miaou.db;
	db.upgrade('survey', path.resolve(__dirname, 'sql'));
}
