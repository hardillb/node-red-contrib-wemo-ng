"use strict";

var WeMo = require('./lib/wemo.js');

var http = require('http');
var util = require('util');
var xml2js  = require('xml2js');

var postbodyheader = [
	'<?xml version="1.0" encoding="utf-8"?>',
	'<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">',
		'<s:Body>'].join('\n');


var postbodyfooter = ['</s:Body>',
	'</s:Envelope>'
].join('\n');

var getcapabilities = {};
getcapabilities.path = '/upnp/control/bridge1';
getcapabilities.action = '"urn:Belkin:service:bridge:1#GetCapabilityProfileIDList"';
getcapabilities.body = [
	postbodyheader, 
	'<u:GetCapabilityProfileIDList xmlns:u="urn:Belkin:service:bridge:1">', 
	'<DevUDN>%s</DevUDN>', 
	'</u:GetCapabilityProfileIDList>',
	postbodyfooter
].join('\n');

var getcapabilitiesList = {};
getcapabilitiesList.path = '/upnp/control/bridge1';
getcapabilitiesList.action = '"urn:Belkin:service:bridge:1#GetCapabilityProfileList"';
getcapabilitiesList.body = [
	postbodyheader, 
	'<u:GetCapabilityProfileList xmlns:u="urn:Belkin:service:bridge:1">', 
	'<CapabilityIDs>%s</CapabilityIDs>', 
	'</u:GetCapabilityProfileList>',
	postbodyfooter
].join('\n');

var wemo = new WeMo();
wemo.on('discovered', function(device){
	var dev = wemo.get(device);
	console.log("%s - %s - %s:%s %s", device, dev.name, dev.ip, dev.port , dev.udn);
});

//var interval = setInterval(wemo.start.bind(wemo), 60000);
wemo.start();

setTimeout(function(){
	var d = wemo.get("231442B01005F2-8418260000CA0456");
	//var d = wemo.get("231442B01005F2-94103EA2B27803ED");

	if (d) {

		var postoptions = {
			host: d.ip,
			port: d.port,
			path: getcapabilitiesList.path,
			method: 'POST',
			headers: {
				'SOAPACTION': getcapabilitiesList.action,
				'Content-Type': 'text/xml; charset="utf-8"',
				'Accept': ''
			}
		}

		var post_request = http.request(postoptions, function(res) {
			var data = "";
			res.setEncoding('utf8');
			res.on('data', function(chunk) {
				data += chunk;
			});

			res.on('end', function(){
				xml2js.parseString(data,function(err, result) {
					//u:GetCapabilityProfileListResponse
					var list = result["s:Envelope"]["s:Body"][0]["u:GetCapabilityProfileListResponse"][0]["CapabilityProfileList"];
					xml2js.parseString(list, function (err, result2){
						console.log(util.inspect(result2, { depth: null }));
					});
				});
			});

		});

		post_request.write(util.format(getcapabilitiesList.body, "10006,10008,30008,30009,3000A,10300,30301"));
		post_request.end();

	}

}, 11000);