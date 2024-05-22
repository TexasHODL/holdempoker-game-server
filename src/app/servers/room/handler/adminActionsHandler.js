/*
* @Author: noor
* @Date:   2018-02-19 17:39:42
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-28 15:13:03
*/

/*jshint node: true */
"use strict";

const successResponse = { success:true };
const failureResponse = { success:false, info:"The table is not in running state." };

var Handler = function (app) {
  this.app = app;
  this.broadcast = app.channelService.broadcast.bind(app.channelService, app.get("frontendType"));
};

module.exports = function (app) {
  return new Handler(app);
};

var handler = Handler.prototype;

// wrapped channel push message
let pushMessage = (app, data, cb)=>{
	let channel = app.channelService.getChannel(data.channelId, false);
	channel && channel.pushMessage(data);
	cb(null, channel ? successResponse : failureResponse);
};

// announce API from dashboard
// either to tables
// or all players
handler.informUsers = function(msg, session, next){
	let data = { serverDown: true, channelId: msg.channelId||msg.tableId, heading: msg.heading||"Message From Admin", info: msg.broadcastMessage, route: "playerInfo", buttonCode:1 };

	switch(msg.broadcastType){
		case "table":
			pushMessage(this.app, data, next);
			break;
		case "players":
			this.broadcast(data.route, data);
			next(null, { success:true });
			break;
		default:
			next(null, { success:false, info:"Wrong broadcastType"});
	}					
};