/*jshint node: true */
"use strict";

  var broadcastHandler 	= require("./broadcastHandler"),
    zmqPublish          = require("../../../../shared/infoPublisher.js"),
    stateOfX            = require("../../../../shared/stateOfX.js"),
    _                   = require("underscore");

var pomelo = require('pomelo');
function actionLogger() {}

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'actionLogger';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

/**
 * broadcsat for disable chat if all in occured on table in room
 * @method handlePlayerTurnBroadcast
 * @param  {Object}                  channel    pomelo channel for room
 * @param  {String}                  channelId  channel name
 * @param  {String}                  eventName  eventName of action
 * @param  {String}                  actionName action of player move
 * @param  {String}                  text       log text
 */
var handlePlayerTurnBroadcast = function(channel, channelId, eventName, actionName, text) {
  if(eventName === stateOfX.logEvents.playerTurn) {
    text = text.replace("\n", "");
    // Set all in occured in this channel, disable chat and text in dealer chat as well
    if(!channel.allInOccuredOnChannel && actionName === stateOfX.move.allin) {
      if(!channel.allInOccuredOnChannel) {
        broadcastHandler.fireChatDisabled({channel: channel, channelId: channelId});
        broadcastHandler.fireDealerChat({channel: channel, channelId: channelId, message: "The player chat has been disabled now due to All In."});
      }
      channel.allInOccuredOnChannel = true;
    }
  }
};

/**
 * broadcasts dealer chat on every action
 * @method fireDealerChat
 * @param  {Object}       channel   pomelo channel for room
 * @param  {String}       channelId channel name
 * @param  {Object}       message   data for dealer chat
 */
var fireDealerChat = function(channel, channelId, message) {
  broadcastHandler.fireDealerChat({channel: channel, channelId: channelId, message: message});
};

/**
 * This function broadcast a new hand tab entry on game over
 * @method fireHandTabOnSummaryBroadcast
 * @param  {String}                      eventName eventName of action
 * @param  {Object}                      channel   pomelo channel object for room
 * @param  {String}                      channelId channel name
 * @param  {Object}                      handTab   data of hand tab; contains cards and pot
 */
var fireHandTabOnSummaryBroadcast = function(eventName, channel, channelId, handTab) {
  if(eventName === stateOfX.logEvents.summary) {
    broadcastHandler.fireHandtabBroadcast({channel: channel, channelId: channelId, handTab: handTab});
  }
};

// ### Create game event logs and Dealer chat
// // > If the dealer sends last chat as SUMMARY
// > Send hand tab broadcast at the same time
// > So that a new hand histroy tab will be added into client hand tab

actionLogger.createEventLog = function (params) {
  if(!!params.data && !!params.data.channelId) {
    serverLog(stateOfX.serverLogType.info, "params in createEventLog keys - " + JSON.stringify(_.keys(params)));
    serverLog(stateOfX.serverLogType.info, "params.data in createEventLog keys - " + JSON.stringify(_.keys(params.data)));
    serverLog(stateOfX.serverLogType.info, "params.data.rawData in createEventLog keys - " + JSON.stringify(_.keys(params.data.rawData)));
    pomelo.app.rpc.database.tableRemote.createLog({}, {channelId:  params.data.channelId, data: params.data}, function (createLogResponse) {
      if(createLogResponse.success) {
        serverLog(stateOfX.serverLogType.info, 'createLogResponse.data' + JSON.stringify(createLogResponse.data));
        if (!(params.data.eventName == stateOfX.logEvents.joinChannel && !params.data.rawData.firstJoined)) {
        fireDealerChat(params.channel, params.data.channelId, createLogResponse.data.text);
        }
        handlePlayerTurnBroadcast(params.channel, params.data.channelId, params.data.eventName, params.data.rawData.actionName, createLogResponse.data.text);
        fireHandTabOnSummaryBroadcast(params.data.eventName, params.channel, params.data.channelId, createLogResponse.data.handTab);
      } else {
        serverLog(stateOfX.serverLogType.error, 'createLogResponse - ' + JSON.stringify(createLogResponse));
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.error, 'Not creating log for an event in as some argument channelId is missing, to prevent table lock issue. ' + JSON.stringify(_.keys(params)));
  }
};

module.exports = actionLogger;