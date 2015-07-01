
function renderBattleProfile(){
	throw "nye"; // ATTENTION: CA CRASHE QUAND ON UTILISE UN AUTRE AUTH EXTERNE
}
function createBattleProfile(){
	throw "nye"; // ATTENTION: CA CRASHE QUAND ON UTILISE UN AUTRE AUTH EXTERNE
}
exports.name = "Battle.net";
exports.externalProfile = {
	creation: {
		fields: [],
		oauth: {
		},
		create: createBattleProfile
	},
	render: renderBattleProfile,
}
