"use strict";
var util = require('util');
var ip = require('ip');
var bodyParser = require('body-parser');

var WeMoNG = require('./lib/wemo.js');

var wemo = new WeMoNG();	

var subscriptions = {};

function subscribe(node) {
	console.log("subscribe - %s", node.id);
	var dev = node.dev;
	console.log("dev - %s", dev);
	if (wemo.get(dev)){
		console.log("%s", wemo.get(dev).name);
		var ipAddress = ip.address();
		if (subscriptions[dev]) {
			//exists
		} else {
			//new
			subscriptions[dev] = {'foo': 'bar'};
		}
	}
}

function unsubscribe(node) {
	console.log("subscribe - %s", node.id);
	var dev = node.dev;
	if (subscriptions[dev]) {
		delete subscriptions[dev];
	} else {
		//shouldn't ever get here
	}
}

//this won't work as there is no way to stop it...
//but is that a problem?
var interval = setInterval(wemo.start.bind(wemo), 60000);
wemo.start();
//search();

module.exports = function(RED) {

	function wemoNGConfig(n) {
		RED.nodes.createNode(this,n);
		this.device = n.device;
	}
	RED.nodes.registerType("WeMoNG-dev", wemoNGConfig);

	function wemoNGNode(n) {
		RED.nodes.createNode(this,n);
		this.device = n.device;
		this.dev = RED.nodes.getNode(this.device).device;
		var node = this;

		//console.log("Control - %j" ,this.dev);

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
				toggleSocket(dev, on);
			} else if (dev.type == 'light`') {
				setStatus(dev,"10006", on);
			} else {
				console.log("group");
			}
		});
	}
	RED.nodes.registerType("WeMoNG out", wemoNGNode);

	function wemoNGEvent(n) {
		RED.nodes.createNode(this,n);
		this.device = n.device;
		this.dev = RED.nodes.getNode(this.device).device;
		var node = this;
		
		//subscribe to events
		if (wemo.get(this.dev)) {
			subscribe(node);
		} else {
			console.log("not discovered yet");
			setTimeout(function(){
				subscribe(node);
			},10000);
		}

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

	RED.httpAdmin.use('/wemoNG/notification/*',bodyParser.raw({type: 'text/xml'}));

	RED.httpAdmin.notify('/wemoNG/notification/*', function(req, res){

	});

}