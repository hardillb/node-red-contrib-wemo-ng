"use strict";

var WeMo = require('./lib/wemo.js');

var wemo = new WeMo();
wemo.on('discover', function(device){
	console.log("%j", device);
});

wemo.start();