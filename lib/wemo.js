"use strict"

var events = require('events');
var util = require('util');
var Client = require('node-ssdp').Client;
var xml2js  = require('xml2js');
var request = require('request');
var http = require('http');
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


var WeMoNG = function () {
	this.devices = {};
	this._client;
	this._interval;
	events.EventEmitter.call(this);

}

util.inherits(WeMoNG, events.EventEmitter);

WeMoNG.prototype.start = function start() {
	console.log("searching");
	var _wemo = this;
	_wemo._client = new Client();
	_wemo._client.setMaxListeners(0);
	_wemo._client.on('response', function (headers, statusCode, rinfo) {
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
													"udn": device.UDN,
													"name": devinfo[i].FriendlyName[0],
													"id": devinfo[i].DeviceID[0],
													"state": devinfo[i].CurrentState[0],
													"type": "light",
													"device": device
												};
												var key = device.serialNumber + "-" + light.id;
												if (!_wemo.devices[key]){
													_wemo.devices[key] = light;
													_wemo.emit('discovered', key);
												} else {
													_wemo.devices[key] = light;
												}
											}
											var groupinfo = result2.DeviceLists.DeviceList[0].GroupInfos;
											if (groupinfo) {
												for(var i=0; i<groupinfo.length; i++) {
													var group = {
														"ip": ip,
														"port": port,
														"udn": device.UDN,
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
												var key = device.serialNumber + "-" + group.id;
												if (!_wemo.devices[key]) {
													_wemo.devices[key] = group;
													_wemo.emit('discovered', key);
												} else {
													_wemo.devices[key] = group;
												}
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
					if (!_wemo.devices[device.serialNumber]) {
						_wemo.devices[device.serialNumber] = socket;
						_wemo.emit('discovered',device.serialNumber);
					} else {
						_wemo.devices[device.serialNumber] = socket;
					}
				}
			});
		});
	});
	_wemo._client.search(urn);
	setTimeout(function(){
		console.log("stopping");
		_wemo._client._stop();
		//console.log("%j", devices);
	}, 10000);
}

WeMoNG.prototype.get = function get(deviceID) {
	return this.devices[deviceID];
}

WeMoNG.prototype.toggleSocket = function toggleSocket(socket, on) {
  var postoptions = {
        host: socket.ip,
        port: socket.port,
        path: "/upnp/control/basicevent1",
        method: 'POST',
        headers: {
          'SOAPACTION': '"urn:Belkin:service:basicevent:1#SetBinaryState"',
          'Content-Type': 'text/xml; charset="utf-8"',
          'Accept': ''
        }
      };

      var post_request = http.request(postoptions, function(res) {
        var data = "";
        res.setEncoding('utf8');
        res.on('data', function(chunk){
          data += chunk
        });

        res.on('end', function(){
          //console.log(data);
        });
      });

    var body = [
      postbodyheader,
      '<u:SetBinaryState xmlns:u="urn:Belkin:service:basicevent:1">',
      '<BinaryState>%s</BinaryState>',
      '</u:SetBinaryState>',
      postbodyfooter
    ].join('\n');

    post_request.write(util.format(body, on));
    post_request.end();
}

WeMoNG.prototype.setStatus = function setStatus(light, capability, value) {
  var setdevstatus = {};
  setdevstatus.path = '/upnp/control/bridge1';
  setdevstatus.action = '"urn:Belkin:service:bridge:1#SetDeviceStatus"';
  setdevstatus.body = [
    postbodyheader,
    '<u:SetDeviceStatus xmlns:u="urn:Belkin:service:bridge:1">',
    '<DeviceStatusList>',
    '&lt;?xml version=&quot;1.0&quot; encoding=&quot;UTF-8&quot;?&gt;&lt;DeviceStatus&gt;&lt;IsGroupAction&gt;NO&lt;/IsGroupAction&gt;&lt;DeviceID available=&quot;YES&quot;&gt;%s&lt;/DeviceID&gt;&lt;CapabilityID&gt;%s&lt;/CapabilityID&gt;&lt;CapabilityValue&gt;%s&lt;/CapabilityValue&gt;&lt;/DeviceStatus&gt;',
    '</DeviceStatusList>',
    '</u:SetDeviceStatus>',
    postbodyfooter
  ].join('\n');

  var postoptions = {
    host: light.ip,
    port: light.port,
    path: setdevstatus.path,
    method: 'POST',
    headers: {
      'SOAPACTION': setdevstatus.action,
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

    res.on('end', function() {
      //console.log(data);
    });
  });

  post_request.on('error', function (e) {
    console.log(e);
    console.log("%j", postoptions);
  });

  //console.log(util.format(setdevstatus.body, light.id, capability, value));

  post_request.write(util.format(setdevstatus.body, light.id, capability, value));
  post_request.end();
}

module.exports  = WeMoNG;