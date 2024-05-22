/*jshint node: true */
"use strict";

// Created by Sushil on  6/2/2017
// this file is for  getting online players in the game at run time

var _               = require('underscore'),
  keyValidator      = require("../../../../shared/keysDictionary"),
  imdb              = require("../../../../shared/model/inMemoryDbQuery.js"),
  stateOfX          = require("../../../../shared/stateOfX.js"),
  db                = require("../../../../shared/model/dbQuery.js"),
  broadcastHandler  = require('./broadcastHandler'),
  sendMessage       = require('./sendMessageToSessions'),
  zmqPublish        = require("../../../../shared/infoPublisher.js");
  // async             = require("async");

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'onlinePlayers';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

var onlinePlayers = {};


/**
 * function to processOnlinePlayers 
 *
 * @method initilizeParams
 * @param  {Object}       params  request json object {self}
 */
onlinePlayers.processOnlinePlayers = function(params) {
  keyValidator.validateKeySets("Request", "connector", "processOnlinePlayers", params, function (validated){
    if(validated.success) {
//      console.error(params.self);
      // onlinePlayers = params.self.app.sessionService.getSessionsCount();
      // serverLog(stateOfX.serverLogType.info,'onlinePlayers are - ' + onlinePlayers);
      // imdb.updateOnlinePlayers(onlinePlayers);
      var onlinePlayersCount =0;
      db.findUserSessionCountInDB({},function(err,resultCount){
        if(err){
          onlinePlayersCount = 0;
        }else{
          onlinePlayersCount = resultCount;
          sendMessage.sendMessageToSessions({data: {onlinePlayers : onlinePlayersCount, event: stateOfX.recordChange.onlinePlayers}, route: stateOfX.broadcasts.onlinePlayers});
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info,validated);
    }
  });
};
/**
 * function to getOnlinePlayer 
 *
 * @method getOnlinePlayer
 * cb                     callback
 * @param  {Object}       params  request json object {self}
 */
onlinePlayers.getOnlinePlayer = function(params, cb) {
  keyValidator.validateKeySets("Request", "connector", "getOnlinePlayer", params, function (validated){
    if(validated.success) {
      onlinePlayers = params.self.app.sessionService.getSessionsCount();
      serverLog(stateOfX.serverLogType.info,"online players count is - " + onlinePlayers);
      cb({success: true, onlinePlayersCount: onlinePlayers});
    } else {
      serverLog(stateOfX.serverLogType.info,validated);
      cb(validated);
    }
  });
};

module.exports = onlinePlayers;