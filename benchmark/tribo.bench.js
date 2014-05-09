// benchmarking of core logic of Tribo

var games = [
	'{"type":"Tribo","status":"finished","moves":"T¯Uº_°iSI®Ä¤?6Îs>=3tÙ~ãk<líÅb¼vW±N¥D¦:9½8.îOïäÛmCÇ,"}',
	'{"type":"Tribo","status":"finished","moves":"J°UºTÄ¦_ÎisØ}âì@7.-AK"}',
	'{"type":"Tribo","status":"finished","moves":"^¸_®]V­`¯°jM¦W·URÀC9/ÊihrqÔßsg}ÞGàë~ìê£¢=¤3*¬¿+¾¥)FQ´5"}',
	'{"type":"Tribo","status":"running","moves":"T¯^"}'
].map(function(s){ return JSON.parse(s)});

var Tribo = require('../plugins/ludogene/client-scripts/Tribo.js');

function restoreGames(){
	games.forEach(function(g){
		Tribo.restore(g);
	});
}

function replayGames(){
	games.forEach(function(sg, i){
		var ng = {};
		Tribo.restore(ng);
		[].map.call(sg.moves, Tribo.decodeMove).forEach(function(m, i){
			if (Tribo.isValid(ng,m)) {
				ng.moves += sg.moves[i];
				Tribo.apply(ng,m);
			} else {
				console.log("invalid move - should not happen", i);
			}
		});
		if (ng.scores[0]!=sg.scores[0]) {
			console.log("incoherent replay - should not happen");
		}
	});
}

function time(f, N){
	console.log("Starting " + f.name);
	var start = Date.now(), end;
	for (var i=N;i-->0;) f();
	end = Date.now();
	console.log(' -> ' + ((end-start)/N).toFixed(2) + ' ms');
}

time(restoreGames, 5000);
time(replayGames, 300);
