"use strict";
var Client = require('node-ssdp').Client;
var request = require('request');
var xml2js  = require('xml2js');
var os = require('os');
var http = require('http');
var util = require('util');
var url = require('url');

var urn = 'urn:Belkin:service:basicevent:1';
var postbodyheader = [
	'<?xml version="1.0" encoding="utf-8"?>',
	'<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">',
		'<s:Body>'].join('\n');


var postbodyfooter = ['</s:Body>',
	'</s:Envelope>'
].join('\n');


var getenddevs = {};
getenddevs.path = '/upnp/control/bridge1';
getenddevs.action = '"urn:Belkin:service:bridge:1#GetEndDevices"';
getenddevs.body = [
	postbodyheader, 
	'<u:GetEndDevices xmlns:u="urn:Belkin:service:bridge:1">', 
	'<DevUDN>%s</DevUDN>', 
	'<ReqListType>PAIRED_LIST</ReqListType>',
	'</u:GetEndDevices>',
	postbodyfooter
].join('\n');

var devices = {};
var client;

function search() {
	console.log("searching");
	client = new Client();
	client.setMaxListeners(0);
	client.on('response', function (headers, statusCode, rinfo) {
		var location = url.parse(headers.LOCATION);
		var port = location.port;
		//console.log(headers);
		request.get(location.href, function(err, res, xml) {
			xml2js.parseString(xml, function(err, json) {
				var device = { ip: location.hostname, port: location.port };
				for (var key in json.root.device[0]) {
					device[key] = json.root.device[0][key][0];
				}
				if (device.deviceType == "urn:Belkin:device:bridge:1") {
					var ip = device.ip;
					var port = device.port;
					var udn = device.UDN;
					var postoptions = {
						host: ip,
						port: port,
						path: getenddevs.path,
						method: 'POST',
						headers: {
							'SOAPACTION': getenddevs.action,
							'Content-Type': 'text/xml; charset="utf-8"',
							'Accept': ''
						}
					};

					var post_request = http.request(postoptions, function(res) {
						var data = "";
						res.setEncoding('utf8');
						res.on('data', function(chunk) {
							data += chunk;
						});

						res.on('end',function() {
							xml2js.parseString(data, function(err, result) {
								if(!err) {
									var list = result["s:Envelope"]["s:Body"][0]["u:GetEndDevicesResponse"][0].DeviceLists[0];
									xml2js.parseString(list, function(err, result2) {
										if (!err) {
											var devinfo = result2.DeviceLists.DeviceList[0].DeviceInfos[0].DeviceInfo;
											for (var i=0; i<devinfo.length; i++) {
												var light = {
													"ip": ip,
													"port": port,
													"udn": device.udn,
													"name": devinfo[i].FriendlyName[0],
													"id": devinfo[i].DeviceID[0],
													"state": devinfo[i].CurrentState[0],
													"type": "light",
													"device": device
												};
												devices[device.serialNumber + "-" + light.id] = light;
											}
											var groupinfo = result2.DeviceLists.DeviceList[0].GroupInfos;
											if (groupinfo) {
												for(var i=0; i<groupinfo.length; i++) {
													var group = {
														"ip": ip,
														"port": port,
														"udn": device.udn,
														"name": groupinfo[i].GroupInfo[0].GroupName[0],
														"id": groupinfo[i].GroupInfo[0].GroupID[0],
														"state": groupinfo[i].GroupInfo[0].GroupCapabilityValues[0],
														"type": "light group",
														"lights": [],
														"device": device
													}
													for(var j=0; j<groupinfo[i].GroupInfo[0].DeviceInfos[0].DeviceInfo.length; j++) {
														group.lights.push(groupinfo[i].GroupInfo[0].DeviceInfos[0].DeviceInfo[j].DeviceID[0]);
													}
												}
												devices[device.serialNumber + "-" + group.id] = group;
											}
										}
									});
								}
							});
						});
					});

					post_request.write(util.format(getenddevs.body, udn));
					post_request.end();

				} else {
					//socket
					var socket = {
						"ip": location.hostname,
						"port": location.port,
						"name": device.friendlyName,
						"type": "socket",
						"device": device
					};
					devices[device.serialNumber] = socket;
				}
			});
		});
	});
	client.search(urn);
	setTimeout(function(){
		console.log("stopping");
		client._stop();
		//console.log("%j", devices);
	}, 10000);
}


//this won't work as there is no way to stop it...
//but is that a problem?
var interval = setInterval(search, 60000);
search();

module.exports = function(RED) {

	function wemoNGConfig(n) {
		RED.nodes.createNode(this,n);
		this.device = n.device;
	}
	RED.nodes.registerType("WeMoNG-dev", wemoNGConfig);

	function wemoNGNode(n) {
		RED.nodes.createNode(this,n);
	}
	RED.nodes.registerType("WeMo-control", wemoNGNode);

	function wemoNGEvent(n) {
		RED.nodes.createNode(this,n);

		this.on('close', function(done){
			//should un subscribe from events
			done();
		});
	}
	RED.nodes.registerType("WeMo-event", wemoNGEvent)

	RED.httpAdmin.get('/wemoNG/devices', function(req,res){
		res.json(devices);

	});

	RED.httpAdmin.notify('/wemoNG/notification/*', function(req, res){

	});

}