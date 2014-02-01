// documentation of called pages :
//   http://sp.mountyhall.com/
//   http://sp.mountyhall.com/SP_WebService.php

var Promise = require("bluebird"),
	iconvlite = require('iconv-lite'),
	http = require('http');

var soap_profil_query_format = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>'+
	'<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:tns="urn:SP_WebService" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/">'+
	'<SOAP-ENV:Body><mns:Profil xmlns:mns="uri:mhSp" SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'+
	'<numero xsi:type="xsd:string">{{mh_num}}</numero><mdp xsi:type="xsd:string">{{mh_mdpr}}</mdp>'+
	'</mns:Profil></SOAP-ENV:Body></SOAP-ENV:Envelope>';

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

// doesn't seem to work
//~ function fetchMHSOAPProfile(num, mdpr){
	//~ var p = Promise.defer(),
		//~ query = soap_profil_query_format.replace(/{{([^}]+)}}/g, function(_,n){ return vals[n] });
	//~ console.log('QUERY:', query);
	//~ var req = http.request({
		//~ hostname: "sp.mountyhall.com",
		//~ path: "/SP_WebService.php",
		//~ method: "POST"
	//~ }, function(res){
		//~ console.log('STATUS: ' + res.statusCode);
		//~ console.log('HEADERS: ' + JSON.stringify(res.headers));
		//~ res.on('data', function (chunk) {
			//~ console.log('BODY: ' + chunk);
		//~ });
	//~ });
	//~ req.on('error', function(e) {
		//~ console.log('problem with request: ' + e.message);
	//~ });
	//~ req.write(query);
	//~ req.end();
//~ }

// returns a promise
// updates and provides in resolution the pluginPlayerInfos if successful, else throws an error 
function createMHProfile(pluginPlayerInfos, vals) {
	return fetchSP('ProfilPublic2', vals.mh_num, vals.mh_mdpr)
	.then(function(lines){
		var l = lines[0], troll = {
			id:l[0], nom:l[1], race:l[2], blason:l[6]
		};
		pluginPlayerInfos.troll = troll;
		return pluginPlayerInfos;
	}).catch(function(err){
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
		description: "",
		fields: [
			{ name:'mh_num', label:'Numéro', type:'Number' },
			{ name:'mh_mdpr', label:'Mot de passe restreint'}
		],
		create: createMHProfile
	}, render: renderMHProfile
}
