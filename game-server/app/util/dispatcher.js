/*jshint node: true */
"use strict";

var crc = require('crc');

// select an item from list based on key
module.exports.dispatch = function(key, list) {
	//console.log("key and list is",key,list);
	var index;
	if(!!list) {
		index = Math.abs(crc.crc32(key)) % list.length;
	} else {
		//console.log('No connector found in dispatcher!');
		index = 0;
	}
	//console.log("returned connector server is ",list[index]);
	return list[index];
};