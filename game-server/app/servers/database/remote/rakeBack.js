/*jshint node: true */
"use strict";

/* Created by Amrendra 02/08/2016 */

var _ld = require("lodash"),
	_ = require('underscore'),
	stateOfX = require("../../../../shared/stateOfX"),
	db = require("../../../../shared/model/dbQuery"),
	adminDb = require("../../../../shared/model/adminDbQuery"),
	ObjectID = require("mongodb").ObjectID,
	rakeBack = {};
const configConstants = require('../../../../shared/configConstants');
// Create data for log generation

function serverLog(type, log) {
	var logObject = {};
	logObject.fileName = 'rakeBack';
	logObject.serverName = stateOfX.serverType.database;
	// logObject.functionName  = arguments.callee.caller.name.toString();
	logObject.type = type;
	logObject.log = log;
	//   zmqPublish.sendLogMessage(logObject);
	console.log(JSON.stringify(logObject));
}


rakeBack.registerRakeback = function (params, cb) {
    serverLog(stateOfX.serverLogType.info, 'registerRakeback - ' + JSON.stringify(params));

    db.findUser({ playerId: params.rakeByUserid }, function (err, user) {
        if (!err && user) {
            let isDirectPlayer = !user.sponserId || user.sponserId === 'admin' || user.sponserId === '' ? true : false;
            console.log("Test registerRakeback");
            console.log(isDirectPlayer);
            if (user.isParentUserName && user.isParentUserName.length > 0) {
                return cb({ success: true, params: params })
            }
            if (!isDirectPlayer) {
                db.findUser({ userName: user.sponserId }, function (err, firstLine) {
                    if (!err && firstLine && firstLine.sponserId && firstLine.sponserId.length > 0 && firstLine.sponserId != 'admin') {
                        db.findUser({ userName: firstLine.sponserId }, function (err, secondLine) {
                            if (!err) {
                                adminDb.getRakebackConfig(function (err, getRakebackConfig) {
                                    if (!err && getRakebackConfig) {
                                        adminDb.createRakeReport({
                                            username: user.userName,
                                            RakeGenerated: params.amount,
                                            HandId: params.handId,
                                            Timestamp: new Date(),
                                            GameType: params.GameType,
                                            TableName: params.TableName,
                                            RakeToAdmin: params.amount * getRakebackConfig.toAdminPercent/100,
                                            RakeTo1StLine: params.amount * getRakebackConfig.to1stLinePercent/100,
                                            RakeTo1StLineName: firstLine.userName,
                                            RakeTo2ndLine: params.amount * getRakebackConfig.to2ndLinePercent/100,
                                            RakeTo2ndLineName: secondLine.userName,
                                            playerId: params.rakeByUserid,
                                            tableId: params.tableId,
                                            isBot: params.isBot,
                                            timestamp: moment().toISOString()
                                        }, function (err, result) {
                                            console.log("=========1=========", result);
                                        })
                                    }
                                });
                                cb({ success: true, params: params });
                            }
                        });
                    } else if (firstLine) {
                        adminDb.createRakeReport({
                            username: user.userName,
                            RakeGenerated: params.amount,
                            HandId: params.handId,
                            Timestamp: new Date(),
                            GameType: params.GameType,
                            TableName: params.TableName,
                            RakeToAdmin: params.amount * ((100-firstLine.rakeBack)/100),
                            RakeTo1StLine: params.amount * (firstLine.rakeBack /100),
                            RakeTo1StLineName: firstLine.userName,
                            RakeTo2ndLine: 0,
                            RakeTo2ndLineName: "",
                            playerId: params.rakeByUserid,
                            tableId: params.tableId,
                            isBot: params.isBot,
                            timestamp: moment().toISOString()
                        }, function (err, result) {
                            console.log("=========2=========", result);
                        })
                        cb({ success: true, params: params });
                    }
                });
            } else {
                adminDb.createRakeReport({
                    username: user.userName,
                    RakeGenerated: params.amount,
                    HandId: params.handId,
                    Timestamp: new Date(),
                    GameType: params.GameType,
                    TableName: params.TableName,
                    RakeToAdmin: params.amount,
                    RakeTo1StLine: 0,
                    RakeTo1StLineName: "",
                    RakeTo2ndLine: 0,
                    RakeTo2ndLineName: "",
                    playerId: params.rakeByUserid,
                    tableId: params.tableId,
                    isBot: params.isBot,
                    timestamp: moment().toISOString()
                }, function (err, result) {
                    console.log("=========3=========", result);
                })
                cb({ success: true, params: params });
            }
        } else {
            cb(err);
        }
    });

}

module.exports = rakeBack;
