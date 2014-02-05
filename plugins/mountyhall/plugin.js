// documentation of called pages :
//   http://sp.mountyhall.com/
//   http://sp.mountyhall.com/SP_WebService.php

var Promise = require("bluebird"),
	iconvlite = require('iconv-lite'),
	http = require('http');

exports.name = "MountyHall";

// queries a SP ("script public")
// returns a promise which is resolved if all goes well with an array of arrays of strings (a csv table)
function fetchSP(sp, num, mdpr){
	var p = Promise.defer();
	var req = http.request({
		hostname: "sp.mountyhall.com",
		path: "/SP_"+sp+".php?Numero="+num+"&Motdepasse="+encodeURIComponent(mdpr),
		method: "GET"
	}, function(res){
		var lines = [];
		res.on('data', function (chunk) {
			lines.push(iconvlite.decode(chunk, 'ISO-8859-1').toString().split(';'));
		}).on('end', function(){
			if (lines.length>0 && lines[0].length>1) {
				p.resolve(lines);
			} else {
				p.reject('Error : ' + JSON.stringify(lines));
			}
		});
	});
	req.on('error', function(e) {
		p.reject('request error');
	});
	req.end();
	return p.promise;
}

// returns a promise
// updates and provides in resolution the pluginPlayerInfos if successful, else throws an error 
function createMHProfile(user, pluginPlayerInfos, vals) {
	return fetchSP('ProfilPublic2', vals.mh_num, vals.mh_mdpr)
	.then(function(lines){
		var l = lines[0], troll = {
			id:l[0], nom:l[1], race:l[2], blason:l[6]
		};
		pluginPlayerInfos.troll = troll;
		pluginPlayerInfos.mdpr = vals.mh_mdpr;
		return pluginPlayerInfos;
	}).catch(function(err){ // FIXME : check but I don't think there should be a catch here...
		console.log('Error in fetching SP', err);
	});
}

// returns the HTML of the profile
// or undefined if there's no profile
function renderMHProfile(ppi) {
	var html = '';
	if (ppi && ppi.troll && ppi.troll.id && ppi.troll.race) {
		html += '<div style="background:url(http://games.mountyhall.com/MH_Packs/packMH_parchemin/fond/fond2.jpg);padding:2px;min-height:60px;line-height:30px;">';
		if (ppi.troll.blason) html += '<img align=left style="max-width:60px;max-height:60px; margin-right:10px;" src="'+ppi.troll.blason+'">';
		html += '<a target=_blank href=http://games.mountyhall.com/mountyhall/View/PJView.php?ai_IDPJ='+ppi.troll.id+'>'+ppi.troll.nom+'</a>';
		html += '<br>'+ppi.troll.race;
		html += '</div>';
	} else {
		html += '<i class=error>profil invalide</i>'
	}
	return html;
}

exports.externalProfile = {
	creation: {
		fields: [
			{ name:'mh_num', label:'Numéro', type:'Number' },
			{ name:'mh_mdpr', label:'Mot de passe restreint'}
		],
		create: createMHProfile
	}, render: renderMHProfile
}
