/*jshint node: true */
"use strict";

  var broadcastHandler 	= require("../broadcastHandler"),
    zmqPublish          = require("../../../../../shared/infoPublisher.js"),
    _                   = require("underscore"),
    stateOfX            = require("../../../../../shared/stateOfX.js");

function ofcActionLogger() {}
var pomelo = require('pomelo');
// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'ofcActionLogger';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### Create game event logs and Dealer chat
// // > If the dealer sends last chat as SUMMARY
// > Send hand tab broadcast at the same time
// > So that a new hand histroy tab will be added into client hand tab

ofcActionLogger.createEventLog = function (params) {
  serverLog(stateOfX.serverLogType.info, 'About to create log for ' + params.data.eventName + ' .');
  if(!!params.data && !!params.data.channelId) {
    serverLog(stateOfX.serverLogType.info, "params in createEventLog - " + JSON.stringify(params.data));
    pomelo.app.rpc.database.ofcRequestRemote.createLog(params.session, {channelId:  params.data.channelId, data: params.data}, function (createLogResponse) {
      serverLog(stateOfX.serverLogType.info, 'createLogResponse - ' + JSON.stringify(createLogResponse));
      if(createLogResponse.success) {
        broadcastHandler.fireDealerChat({channel: params.channel, channelId: params.data.channelId, message: createLogResponse.data.text});
      } else {
        serverLog(stateOfX.serverLogType.error, 'createLogResponse - ' + JSON.stringify(createLogResponse));
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.error, 'Not creating log for an event in as some argument channelId is missing, to prevent table lock issue. ' + JSON.stringify(_.keys(params)));
  }
};

module.exports = ofcActionLogger;