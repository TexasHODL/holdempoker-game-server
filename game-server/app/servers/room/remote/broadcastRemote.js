/*
* @Author: sushiljainam
* @Date:   2017-06-23 16:59:05
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-28 15:21:42
*/

/*jshint node: true */
"use strict";


module.exports = function(app) {
	return new BroadcastRemote(app);
};

var BroadcastRemote = function(app) {
	this.app = app;
	this.channelService = app.get('channelService');
};

// generic - pushMessage
// params = {channelId:'', route:'route', msg: {<msg>}}
BroadcastRemote.prototype.pushMessage = function(params, cb) {
	var channel = this.channelService.getChannel(params.channelId, false);
	if(!!channel) {
		channel.pushMessage(params.route, params.msg);
	}
	cb();
};