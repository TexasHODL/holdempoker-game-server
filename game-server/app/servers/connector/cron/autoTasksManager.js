/*
* @Author: sushiljainam
* @Date:   2017-07-12 19:48:48
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-26 16:57:14
*/

/*jshint node: true */
"use strict";

var autoLogOutSchedular =  require('../publicHandler/autoLogOutSchedular');

/**
 * This file initiates cron job as mentioned in crons.json
 * For idle players' auto logout
 */

module.exports = function (app) {
	return new AutoTaskManager(app);
};

function AutoTaskManager(app) {
	this.app = app;
	this.handler =  require('../handler/entryHandler')(app);
}

/**
 * This function is called every time, according to cron job time
 * @method logout
 * @return undefined
 */
AutoTaskManager.prototype.logout = function() {
	console.log('cron job is running.....', 'autoTasksManager.logout');
	var handler = this.handler;
	autoLogOutSchedular.checkAutoLogOut({handler: handler, globalThis: handler});
};