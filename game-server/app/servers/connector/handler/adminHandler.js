/*
* @Author: sushiljainam
* @Date:   2017-12-02 14:52:40
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-26 17:20:51
*/

/*jshint node: true */
"use strict";
const configConstants = require('../../../../shared/configConstants');
var appDir = "../../../../../";
var keyValidator = require("../../../../shared/keysDictionary");
var serverDownManager = require(appDir+ "game-server/app/util/serverDownManager");
var pomelo = require('pomelo');
var ObjectID = require('mongodb').ObjectID;
var confServerDown = configConstants.serverDown || {};

var logger = console.error;
var adminHandler = {};

/**
 * general function to drop mails on maintenannce - uses pomelo plugin - custom made
 * @method dropMail
 * @param  {Object} data various mail args
 */
var dropMail = function (data) {
	data.mailCreatedBy = {serverId: pomelo.app.serverId, timestamp: Number(new Date())};
	var mailTo = confServerDown.reportTos;
	pomelo.app.get('devMailer').sendToAdminMulti(data, mailTo, data.subject || "from "+configConstants.mailFromAppName+" - Server Down Code");
};

/**
 * API - used by web-server
 * add schedule to put servers on maintenannce - step by step
 * saves the task with pending status in db
 * starts various schedulars
 * @method addScheduleServerDown
 * @param  {Object}              msg     contains downtime, uptime etc
 * @param  {Object}              session user session object
 * @param  {Function}            next    callback for response
 */
adminHandler.addScheduleServerDown = function (msg, session, next) {
	keyValidator.validateKeySets("Request", "connector", "addScheduleServerDown", msg, function (validated) {
		dropMail({subject: "Request Received at "+configConstants.mailFromAppName+": To schedule server down", msg: "Request Received: To schedule server down:- with payload - " + JSON.stringify(msg) + " - Soon, Its success will be informed.", rawPayload: msg});
		if (!validated.success) {
			return next(null, validated);
		}

		// msg = {serverDownTime, disableGameStartTime, disableLoginTime, serverReturnTime}
		var currentTime = new Date().getTime();

		// msg.disableGameStartTime = msg.serverDownTime - 15*60*1000;
		// msg.disableLoginTime = msg.serverDownTime - 30*60*1000;
		// msg.serverDownTime = currentTime + 1*60*1000; // local testing
		// msg.disableGameStartTime = msg.serverDownTime - 15*1000; // local testing
		// msg.disableLoginTime = msg.serverDownTime - 30*1000; // local testing

		msg.disableGameStartTime = msg.serverDownTime - (confServerDown.disableGameStartBeforeServerDown_Minutes||55)*60*1000;
		msg.disableLoginTime = msg.serverDownTime - (confServerDown.disableLoginBeforeServerDown_Minutes||10)*60*1000;

		// msg.serverDownTime = currentTime + 5*60*1000; // local testing
		// msg.disableGameStartTime = msg.serverDownTime - 4*60*1000; // local testing
		// msg.disableLoginTime = msg.serverDownTime - 3*60*1000; // local testing
	
		// var proceed = validateTimestamps(currentTime, msg.serverDownTime, msg.disableGameStartTime, msg.disableLoginTime);
		// if (!(proceed===true)) {
		// 	return next(null, {success: false, info: proceed});
		// }

		// msg is all set and good to save and schedule to execute
		var db = require(appDir+ "shared/model/dbQuery.js");
		var dbDoc = {
			type: 'serverDown',
			createdAt: currentTime,
			createdBy: msg.createdBy,
			serverDownTime: msg.serverDownTime,
			serverUpTime: msg.serverUpTime,
			disableGameStartTime: msg.disableGameStartTime,
			disableLoginTime: msg.disableLoginTime,
			status: 'PENDING',
			logs: [("schedule added, "+ new Date())]
		};
		db.addScheduleTask(dbDoc, function (err, result) {
			if (err || !result) {
				dropMail({subject: "Request failed at "+configConstants.mailFromAppName+": To schedule server down", msg: "Request failed: To schedule server down - by db query error"});
				return next(null, {success: false, info: (err.info || 'Saving schedule failed!')});
			} else {
				dropMail({subject: "Request accepted at "+configConstants.mailFromAppName+": To schedule server down", msg: "Request accepted: To schedule server down; Next step: scheduling tasks", scheduleObj: dbDoc});
				// schedule jobs using node scheduler
				scheduleServerDownJobs(dbDoc, result, next);
			}
		});
	});
	// next(null, res)
};

/**
 * API - used by web-server
 * update schedule for server down
 * can only update uptime
 * @method updateScheduleServerDown
 * @param  {Object}                 msg     contains id and uptime
 * @param  {Object}                 session user session object
 * @param  {Function}               next    callback
 */
adminHandler.updateScheduleServerDown = function (msg, session, next) {
	if (msg._id && msg.serverUpTime ) {
		var db = require(appDir+ "shared/model/dbQuery.js");
		db.findScheduleTask({_id: ObjectID(msg._id)}, function (err, result) {
			if (result) {
				if (result.serverUpTime < msg.serverUpTime) {
					db.updateScheduleTask({_id: ObjectID(msg._id)}, {$set: {serverUpTime: msg.serverUpTime}, $push: {logs: ("Up time updated, "+new Date())}}, function (err, result) {
						next(null, {success: true, info: "Up time updated successfully."});
					});
				} else {
					next(null, {success: false, info: 'serverUpTime should be greater than previous entry.'});
				}
			} else {
				next(null, {success: false, info: 'No such task, or not updatable.'});
			}
		});
	} else {
		next(null, {success: false, info: 'Info missing - serverUpTime'});
	}
};

/**
 * API - used by web-server
 * update schedule for cancel task
 * @method removeScheduleServerDown
 * @param  {Object}                 msg     contains id
 * @param  {Object}                 session user session object
 * @param  {Function}               next    callback
 */
adminHandler.removeScheduleServerDown = function (msg, session, next) {
	if (msg._id) {
		var db = require(appDir+ "shared/model/dbQuery.js");
		db.findScheduleTask({_id: ObjectID(msg._id), status: 'PENDING'}, function (err, result) {
			if (result) {
				db.updateScheduleTask({_id: ObjectID(msg._id), status: 'PENDING'}, {$set: {status: 'CANCELLED'}, $push: {logs: ("Schedule cancelled, "+new Date())}}, function (err, result) {
					next(null, {success: true, info: "Task updated successfully."});
				});
			} else {
				next(null, {success: false, info: 'No such task, or not cancel-able.'});
			}
		});
	} else {
		next(null, {success: false, info: 'Info missing'});
	}
};

/**
 * API - used by web-server
 * schedule task to put servers on running
 * saves task in db with pending task
 * starts server up jobs
 * @method scheduleServerUpImmediate
 * @param  {Object}                  msg     contains nothing special
 * @param  {Object}                  session user session object
 * @param  {Function}                next    callback
 */
adminHandler.scheduleServerUpImmediate = function (msg, session, next) {
	// msg is all set and good to save and schedule to execute
	var db = require(appDir+ "shared/model/dbQuery.js");
	var dbDoc = {
		type: 'serverUp',
		createdAt: new Date().getTime(),
		createdBy: msg.createdBy,
		scheduleId: msg.scheduleId,
		status: 'PENDING',
		logs: [("schedule added, "+ new Date())]
	};
	db.addScheduleTask(dbDoc, function (err, result) {
		if (err || !result) {
			return next(null, {success: false, info: (err.info || 'Saving schedule failed!')});
		} else {
			// schedule jobs using node scheduler
			serverUpJobs(dbDoc, result, next);
		}
	});
};

/**
 * API - used by web-server
 * fetch server state whether servers are down or up
 * @method fetchServerState
 * @param  {Object}         msg     contains nothing
 * @param  {Object}         session user session object
 * @param  {Function}       next    callback
 */
adminHandler.fetchServerState = function (msg, session, next) {
	serverDownManager.fetchServerState(function (result) {
		next(null, result);
	});
};

module.exports = adminHandler;

function validateTimeDifference(a, b, minDiff) {
	return ((b - a) >= minDiff);
}

function validateTimestamps(ct, t3, t2, t1) {
	// var configTimeGaps = {
	// g1: (confServerDown.minTimeToServerDownAfterCurrentTime_Minutes||60), 
	// g2: 20, g3: 30}; // production
	var configTimeGaps = {g1: 0.6, g2: 0.2, g3: 0.3}; // test
	var seconds = 1000;
	var minutes = 60*1000;
	var hours = 60*60*1000;
	var days = 24*60*60*1000;
	var f = validateTimeDifference;
	if (!f(ct, t3, configTimeGaps.g1*minutes)) {
		return "Server down time should be valid acc to current time.";
	}
	if (!f(t2, t3, configTimeGaps.g2*minutes)) {
		return "Disable game start time should be valid acc to Server down time.";
	}
	if (!f(t1, t3, configTimeGaps.g3*minutes)) {
		return "Disable login time should be valid acc to Server down time.";
	}
	return true;
}

/**
 * converts a timestamp to indian time by adding 5.5 hours
 * in particular format
 * @method IndianFormat
 * @param  {Number}     timestamp given time to convert
 * @return string format indian time
 */
function IndianFormat(timestamp) {
	timestamp = timestamp + 5.5*(60*60*1000);
	var D = new Date(timestamp);
	var monthNames = [
		"Jan", "Feb", "Mar",
		"Apr", "May", "Jun", "Jul",
		"Aug", "Sep", "Oct",
		"Nov", "Dec"
	];
	return "" + monthNames[D.getMonth()] + " " + D.getDate() + " " + D.getFullYear() + ", " + D.getHours() + ":" + D.getMinutes() + ":" + D.getSeconds();
}

/**
 * starts schedulars to put servers down step by step
 * MOST IMPORTANT function of this file
 * @method scheduleServerDownJobs
 * @param  {Object}               scheduleObj contains maintenance related args; down time, other disable time
 * @param  {Object}               dbResult    contains scheduleId
 * @param  {Function}             cb          callback
 */
function scheduleServerDownJobs(scheduleObj, dbResult, cb) {
	var schedule = require('node-schedule');
	var scheduleId = dbResult.insertedIds[0];

	var configForceLeaveAfterGameDisable_Hours = (confServerDown.forceLeaveAfterGameDisable_Minutes||50)/60;
	// var configForceLeaveAfterGameDisable_Hours = (2/60); // local testing

	cb(null, {success: true, info: 'scheduled'});

	pomelo.app.channelService.broadcast('connector', 'playerInfo', {serverDown: true, heading: 'Server Down', info: 'Server will be under maintenance from '+IndianFormat(scheduleObj.serverDownTime)+' to '+IndianFormat(scheduleObj.serverUpTime)});

	dropMail({subject: "Scheduling started: Server Down - "+configConstants.mailFromAppName, msg: "Scheduling for tasks related to server down started", scheduleId: scheduleId});

	schedule.scheduleJob(new Date(scheduleObj.disableGameStartTime), function (scheduleId) {
		var db = require(appDir+ "shared/model/dbQuery.js");
		db.findScheduleTask({type: 'serverDown', _id: scheduleId}, function (err, result) {
			if (err || !result) {
				logger('schedule task not found - in disableGameStart', err);
				return;
			} else {
				if (result.status == 'PENDING') {
					logger('disable game start started', scheduleId, pomelo.app.serverId);
					db.updateScheduleTask({type: 'serverDown', _id: scheduleId}, {$set: {status: "STARTED"}, $push: {logs: ("Schedule started - disabling game start, "+ new Date())}}, function (err, result) {
						if (err) {
							// drop a mail - process failed
							dropMail({subject: "Scheduling Server Down - "+configConstants.mailFromAppName+": Game Start Disabling - FAILED!!!!", msg: "Please check, Server down process failed.", scheduleId: scheduleId});
						} else {
							serverDownManager.startDisablingGameStart(pomelo.app, scheduleId);
							dropMail({subject: "Scheduling Server Down - "+configConstants.mailFromAppName+": Game Start Disabled", msg: "No new games will be started now.", scheduleId: scheduleId});
						}
					});
				} else {
					logger('schedule task un-scheduled', result.status, result);
					if (serverDownManager.makeSureGameStartEnabled instanceof Function) {
						serverDownManager.makeSureGameStartEnabled(pomelo.app, scheduleId);
					}
				}
			}
		});
	}.bind(null, scheduleId));

	schedule.scheduleJob(new Date(scheduleObj.disableLoginTime), function (scheduleId) {
		var db = require(appDir+ "shared/model/dbQuery.js");
		db.findScheduleTask({type: 'serverDown', _id: scheduleId}, function (err, result) {
			if (err || !result) {
				logger('schedule task not found - in disableLogin', err);
				return;
			} else {
				if (result.status == 'STARTED') {
					logger('disable login started', scheduleId, pomelo.app.serverId);
						db.updateScheduleTask({type: 'serverDown', _id: scheduleId}, {$set: {status: "STARTED"}, $push: {logs: ("Schedule started - disabling login, "+ new Date())}}, function (err, result) {
							if (err) {
								// drop a mail - process failed
								dropMail({subject: "Scheduling Server Down - "+configConstants.mailFromAppName+": Login Disabling - FAILED!!!!", msg: "Please check, Server down process failed.", scheduleId: scheduleId});
							} else {
								serverDownManager.startDisablingLogin(pomelo.app, scheduleId);
								dropMail({subject: "Scheduling Server Down - "+configConstants.mailFromAppName+": Login Disabled", msg: "No new player login will be allowed now. Next step: players' seats will be vacanted forcefully.", scheduleId: scheduleId});
							}
						});
				} else {
					logger('schedule task un-scheduled', result.status, result);
					if(serverDownManager.makeSureLoginEnabled instanceof Function) {
						serverDownManager.makeSureLoginEnabled(pomelo.app, scheduleId);
					}
				}
			}
		});
	}.bind(null, scheduleId));

	schedule.scheduleJob(new Date(scheduleObj.disableGameStartTime+((configForceLeaveAfterGameDisable_Hours||1)*60*60*1000)), function (scheduleId) {
		var db = require(appDir+ "shared/model/dbQuery.js");
		db.findScheduleTask({type: 'serverDown', _id: scheduleId}, function (err, result) {
			if (err || !result) {
				logger('schedule task not found - in force leave', err);
				return;
			} else {
				if (result.status == 'STARTED') {
					logger('force leave started', scheduleId, pomelo.app.serverId);
					db.updateScheduleTask({type: 'serverDown', _id: scheduleId}, {$set: {status: "COMPLETED"}, $push: {logs: ("Schedule started - forcing leave, "+ new Date())}}, function (err, result) {
						if (err) {
							// drop a mail - process failed
							dropMail({subject: "Scheduling Server Down - "+configConstants.mailFromAppName+": Force Leave Starting - FAILED!!!!", msg: "Please check, Server down process failed.", scheduleId: scheduleId});
						} else {
							serverDownManager.startForcedLeave(pomelo.app, scheduleId);
							dropMail({subject: "Scheduling Server Down - "+configConstants.mailFromAppName+": Force Leave Started", msg: "Players will be made force leave from tables now. Next step: Kick player sessions", scheduleId: scheduleId});
						}
					});
				} else {
					logger('schedule task un-scheduled', result.status, result);
					// serverDownManager.makeSureGameStartEnabled(pomelo.app, scheduleId);
				}
			}
		});
	}.bind(null, scheduleId));
}

/**
 * starts schedulars to put servers up all at once
 * @method serverUpJobs
 * @param  {Object}               scheduleObj contains maintenance related args; down time, other disable time
 * @param  {Object}               dbResult    contains scheduleId
 * @param  {Function}             cb          callback
 */
function serverUpJobs(scheduleObj, dbResult, cb) {
	cb(null, {success: true, info: 'scheduled'});
	serverDownManager.startEnablingAll(pomelo.app/*, scheduleId*/);
}
