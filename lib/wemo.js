"use strict"

var events = require('events');
var util = require('util');
var Client = require('node-ssdp').Client;
var xml2js  = require('xml2js');

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


var WeMoNG = function () {
	this.devices = {};
	this._client;
	events.EventEmitter.call(this);

}

util.inherits(WeMoNG, events.EventEmitter);

WeMoNG.prototype.start = function start() {
	console.log("searching");
	var wemo = this;
	wemo._client = new Client();
	wemo._client.setMaxListeners(0);
	wemo._client.on('response', function (headers, statusCode, rinfo) {
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
												wemo.devices[device.serialNumber + "-" + light.id] = light;
												wemo.emit('discovered', light);
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
												wemo.devices[device.serialNumber + "-" + group.id] = group;
												wemo.emit('discovered', group);
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
					wemo.emit('discovered',socket);
				}
			});
		});
	});
	wemo._client.search(urn);
	setTimeout(function(){
		console.log("stopping");
		wemo._client._stop();
		//console.log("%j", devices);
	}, 10000);
}

module.exports  = WeMoNG;