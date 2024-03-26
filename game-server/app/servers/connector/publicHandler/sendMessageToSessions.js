/*jshint node: true */
"use strict";

// Created by Sushil on  6/2/2017
// this file is for sending broadcast to all users 

var _               = require('underscore'),
  keyValidator      = require("../../../../shared/keysDictionary"),
  imdb              = require("../../../../shared/model/inMemoryDbQuery.js"),
  stateOfX          = require("../../../../shared/stateOfX.js"),
  db                = require("../../../../shared/model/dbQuery.js"),
  broadcastHandler  = require('./broadcastHandler'),
  zmqPublish        = require("../../../../shared/infoPublisher.js");
  // async             = require("async");

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'sendMessageToSessions';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

var sendMessage = {};
var pomelo = require('pomelo');
//{self,data,route}
/**
 * this function sends message to all binded sessions
 * @method sendMessageToSessions
 * @param  {[type]}              params   object containing app, required for sending brodacast
 */
sendMessage.sendMessageToSessions = function(params) {
  keyValidator.validateKeySets("Request", "connector", "sendMessageToSessions", params, function (validated){
    if(validated.success) {
      pomelo.app.get('channelService').broadcast("connector", params.route, {data: params.data});
      serverLog(stateOfX.serverLogType.info,'broadcast to world - ' + params.route);
      // pomelo.app.sessionService.forEachBindedSession(function(session) {
      //   var playerId = session.get("playerId");
      //   serverLog(stateOfX.serverLogType.info,'session for playerId is - ' + session.get("playerId"));
      //   broadcastHandler.sendCustomMessageToUser({playerId: playerId, route: params.route, data: params.data}) // Sending broadcast to all players.
      // })
    } else {
      serverLog(stateOfX.serverLogType.info,validated);
    }
  });
};

module.exports = sendMessage;