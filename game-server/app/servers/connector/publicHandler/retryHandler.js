/*jshint node: true */
"use strict";

// Created by Sushil on  21/12/2016
// Provide Joined channel at runtime

var _               = require('underscore'),
  keyValidator      = require("../../../../shared/keysDictionary"),
  imdb              = require("../../../../shared/model/inMemoryDbQuery.js"),
  stateOfX          = require("../../../../shared/stateOfX.js"),
  db                = require("../../../../shared/model/dbQuery.js"),
  zmqPublish        = require("../../../../shared/infoPublisher.js");
  // async             = require("async");
const configConstants = require('../../../../shared/configConstants');
// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'retry Handler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

var retryHandler = {};

// To remove record of OBSERVER player after a pre-definde time
// No need to join a player after a time as OBSERVER


/**
 * this function removes the record of OBSERVER player after a pre-defined time
 * @method getJoinedChannles
 * @param  {object}          params request json object
 * @param  {Function}        cb     callback function
 */
// retryHandler.getJoinedChannles = function(params, cb) {
//   var currentTime = Number(new Date()) - configConstants.removeObserverRecord*60000;
//   serverLog(stateOfX.serverLogType.info,'currentTime - removeObserverRecord is - ' + new Date(currentTime));
//   imdb.removeActivity({playerId:params.playerId, channelType:stateOfX.gameType.normal, updatedAt: {$lte : currentTime}, isSit: {$exists: false}}, function(error, result) {
//     if(!error) {
//     	imdb.getActivity({playerId: params.playerId}, function(err, response) {
//     		if(!err && !!response) {
//           console.error(response);
//     			serverLog(stateOfX.serverLogType.info,'joinedChannels are - ' + JSON.stringify(response));
//     			cb({success: true, joinedChannels: response});
//     		} else {
//     			cb({success: false});
//     		}
//     	});
//     } else {
//       cb({success: false});
//       serverLog(stateOfX.serverLogType.info,'Error in deleting join channels in retryHandler');
//     }
//   })
// }

/**
 * get list of channels joined by a player
 * @method getJoinedChannles
 * @param  {Object}          params contains playerId
 * @param  {Function}        cb     callback
 */
retryHandler.getJoinedChannles = function(params, cb) {
  var currentTime = Number(new Date()) - configConstants.removeObserverRecord*60000;
  serverLog(stateOfX.serverLogType.info,'currentTime - removeObserverRecord is - ' + new Date(currentTime));
  imdb.playerJoinedRecord({playerId:params.playerId}, function(error, result) {
    if(!error) {
      //console.error("@@@@@@@#####$$$$$$",result);
      cb({success: true, joinedChannels: result});
      // imdb.getActivity({playerId: params.playerId}, function(err, response) {
      //  if(!err && !!response) {
     //      console.error(response);
      //    serverLog(stateOfX.serverLogType.info,'joinedChannels are - ' + JSON.stringify(response));
      //    cb({success: true, joinedChannels: result});
      //  } else {
      //    cb({success: false});
      //  }
      // });
    } else {
      cb({success: false});
      serverLog(stateOfX.serverLogType.info,'Error in deleting join channels in retryHandler');
    }
  });
};

module.exports = retryHandler;