"use strict";
var util = require('util');
var ip = require('ip');
var bodyParser = require('body-parser');
var http = require('http');
var os = require('os');

var WeMoNG = require('./lib/wemo.js');

var wemo = new WeMoNG();	

//this won't work as there is no way to stop it...
//but is that a problem?
var interval = setInterval(wemo.start.bind(wemo), 60000);
wemo.start();

module.exports = function(RED) {

	var subscriptions = {};

	function resubscribe() {

	}

	setInterval(resubscribe, 500000);

	function subscribe(node) {
		var dev = node.dev;
		var device = wemo.get(dev);
		if (device){
			if (subscriptions[dev]) {
				//exists
				subscriptions[dev].count++;
			} else {
				//new

				var ipAddr;
				//device.ip
				var interfaces = os.networkInterfaces();
				var interfaceNames = Object.keys(interfaces);
				for (var name in interfaceNames) {
					console.log(interfaces[interfaceNames[name]]);
					var addrs = interfaces[interfaceNames[name]];
					for (var add in addrs) {
						if (addrs[add].netmask){
							//console.log("node 0.12 or better");
							//node 0.12 or better
							if (!addrs[add].internal && addrs[add].family == 'IPv4') {
								//console.log(addrs[add].address);
								if (ip.isEqual(ip.mask(addrs[add].address,addrs[add].netmask),ip.mask(devices.ip,addrs[add].netmask))) {
									ipAddr = addrs[add].address;
									//console.log(addrs[add].address);
									break;
								}
							}
						} else {
							//console.log("node 0.10");
							//node 0.10
							if (!addrs[add].internal && addrs[add].family == 'IPv4') {
								ipAddr = addrs[add].address;
								//console.log(addrs[add].address);
								break;
							}
						}
					}
					if (ipAddr) {
						break;
					}
				}

				var subscribeOptions = {
					host: device.ip,
					port: device.port,
					path: '/upnp/event/basicevent1',
					method: 'SUBSCRIBE',
					headers: {
						'CALLBACK': '<http://' + ipAddr + ':' + RED.settings.uiPort + '/wemoNG/notification' + '>',
						'NT': 'upnp:event',
				 		'TIMEOUT': 'Second-600'
					}
				};

				var sub_request = http.request(subscribeOptions, function(res) {
					subscriptions[dev] = {'count': 1, 'sid': res.headers.sid};
				});

				sub_request.end();

			}
		}
	}

	function unsubscribe(node) {
		var dev = node.dev;
		if (subscriptions[dev]) {
			if (subscriptions[dev].count == 1) {
				delete subscriptions[dev];
			} else {
				subscriptions[dev].count--;
			}
		} else {
			//shouldn't ever get here
		}
	}

	function wemoNGConfig(n) {
		RED.nodes.createNode(this,n);
		this.device = n.device;
	}
	RED.nodes.registerType("WeMoNG-dev", wemoNGConfig);

	function wemoNGNode(n) {
		RED.nodes.createNode(this,n);
		this.device = n.device;
		this.name = n.name;
		this.dev = RED.nodes.getNode(this.device).device;
		var node = this;
		this.status({fill:"red",shape:"dot",text:"searching"});

		//console.log("Control - %j" ,this.dev);
		if (!wemo.get(node.dev)){
			wemo.on('discovered', function(d){
				if (node.dev === d) {
					node.status({fill:"green",shape:"dot",text:"found"});
				}
			});
		} else {
			node.status({fill:"green",shape:"dot",text:"found"});
		}

		this.on('input', function(msg){
			var dev = wemo.get(node.dev);

			if (!dev) {
				//need to show that dev not currently found
				console.log("no device found");
				return;
			} else {
				//console.log("details %j", dev);
			}

			var on = 0;
			if (msg.payload == 'on') {
				on = 1;
			}

			if (dev.type == 'socket') {
				//console.log("socket")
				wemo.toggleSocket(dev, on);
			} else if (dev.type == 'light`') {
				wemo.setStatus(dev,"10006", on);
			} else {
				console.log("group");
			}
		});
	}
	RED.nodes.registerType("WeMoNG out", wemoNGNode);

	function wemoNGEvent(n) {
		RED.nodes.createNode(this,n);
		this.device = n.device;
		this.name = n.name;
		this.dev = RED.nodes.getNode(this.device).device;
		var node = this;
		
		this.status({fill:"red",shape:"dot",text:"searching"});

		//subscribe to events
		if (wemo.get(this.dev)) {
			this.status({fill:"green",shape:"dot",text:"found"});
			subscribe(node);
		} else {
			wemo.on('discovered', function(d){
				if (node.dev === d) {
					node.status({fill:"green",shape:"dot",text:"found"});
					subscribe(node);
				}
			});
		}

		wemo.on('event', function(){

		});

		this.on('close', function(done){
			//should un subscribe from events
			unsubscribe(node);
			done();
		});
	}
	RED.nodes.registerType("WeMoNG in", wemoNGEvent)

	RED.httpAdmin.get('/wemoNG/devices', function(req,res){
		res.json(wemo.devices);

	});

	RED.httpAdmin.use('/wemoNG/notification',bodyParser.raw({type: 'text/xml'}));

	RED.httpAdmin.notify('/wemoNG/notification', function(req, res){
		console.log("sub - %j",req.headers);
		console.log("sub - %s", req.body);
	});

	//console.log("RED - \n%s", util.inspect(RED));

}