/*
* @Author: sushiljainam
* @Date:   2017-07-12 21:00:03
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-28 13:27:39
*/

/*jshint node: true */
"use strict";

var idlePlayersHandler =  require('../roomHandler/idlePlayersHandler');

/**
 * This file initiates cron job as mentioned in crons.json
 * For idle players who are occupied seat on table - vacant seat
 */

module.exports = function (app) {
	return new AutoTaskManager(app);
};

function AutoTaskManager(app) {
	this.app = app;
	this.handler =  require('../handler/channelHandler')(app);
}

/**
 * remove idle sitting player from table
 * check on regular intervals
 * @method idlePlayersRemove
 */
AutoTaskManager.prototype.idlePlayersRemove = function() {
	console.log('cron job is running.....', 'AutoTaskManager.idlePlayersRemove');
	var handler = this.handler;
	idlePlayersHandler.process({handler: handler, globalThis: handler});
};