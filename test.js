"use strict";

var WeMo = require('./lib/wemo.js');

var wemo = new WeMo();
wemo.on('discovered', function(device){
	var dev = wemo.get(device);
	console.log("%s - %s - %s:%s %s", device, dev.name, dev.ip, dev.port , dev.udn);
});

var interval = setInterval(wemo.start.bind(wemo), 60000);
wemo.start();