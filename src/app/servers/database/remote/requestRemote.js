/*jshint node: true */
"use strict";

/**
 * Created by Amrendra on 14/06/2016.
**/
var async         = require("async"),
    _ld           = require("lodash"),
    _             = require("underscore"),
    setMove       = require("./setMove"),
    adjustIndex   = require("./adjustActiveIndex"),
    cardAlgo      = require("../../../util/model/deck"),
    randy         = require("../../../util/model/randy"),
    stateOfX      = require("../../../../shared/stateOfX"),
    keyValidator  = require("../../../../shared/keysDictionary"),
    mongodb       = require("../../../../shared/mongodbConnection"),
    db            = require("../../../../shared/model/dbQuery"),
    zmqPublish    = require("../../../../shared/infoPublisher"),
    lockTable     = require("./lockTable");

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'requestRemote';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// Start zmq publisher
// zmqPublish.startPublisher(7002);

var requestRemote = function (app) {
  // this.app = app;
  // this.channelService = app.get('channelService');
};

// <<<<<<<<<<<<<<<<<<< RPC CALLS HANDLER Started >>>>>>>>>>>>>>>>>>>>>>>>>

/**
 * set one player setting on table
 * @method setPlayerValueOnTable
 */
requestRemote.prototype.setPlayerValueOnTable = function (params, cb) {
  var self = this;
  lockTable.lock({channelId: params.channelId, actionName: "setPlayerValueOnTable", data: params}, function (lockTableResponse){
    if(lockTableResponse.success) {
      keyValidator.validateKeySets("Response", "database", "setPlayerValueOnTable", lockTableResponse.data, function (validated){
        if(validated.success) {
          cb(lockTableResponse.data);
        } else {
          cb(validated);
        }
      });
    } else {
      cb(lockTableResponse);
    }
  });
};

requestRemote.prototype.updateTournamentRules = function (params, cb) {
  var self = this;
  lockTable.lock({channelId: params.channelId, actionName: "updateTournamentRules", data: params}, function (lockTableResponse){
    serverLog(stateOfX.serverLogType.info, 'response from lockTableResponse - ' + JSON.stringify(lockTableResponse));
    if(lockTableResponse.success) {
      cb(lockTableResponse.data);
    } else {
      cb(lockTableResponse);
    }
  });
};

// Lock table and process autosit player into table
// WHEN? when somebody leaves a table and autosit happens for the other player who was in queue
requestRemote.prototype.processAutoSit = function (params, cb) {
  var self = this;
  lockTable.lock({channelId: params.channelId, actionName: "autosit", data: params}, function (lockTableResponse){
    if(lockTableResponse.success) {
      keyValidator.validateKeySets("Response", "database", "processAutoSit", lockTableResponse, function (validated){
        if(validated.success) {
          cb(lockTableResponse);
        } else {
          cb(validated);
        }
      });
    } else {
      cb(lockTableResponse);
    }
  });
};


// Remove player from waiting list for a table
requestRemote.prototype.removeWaitingPlayer = function (params, cb) {
  var self = this;
  lockTable.lock({channelId: params.channelId, actionName: "removeWaitingPlayer", data: params}, function (lockTableResponse){
    if(lockTableResponse.success) {
      keyValidator.validateKeySets("Response", "database", "removeWaitingPlayer", lockTableResponse, function (validated){
        if(validated.success) {
          cb(lockTableResponse);
        } else {
          cb(validated);
        }
      });
    } else {
      cb(lockTableResponse);
    }
  });
};

// Change player state from DISCONNECTED (On join)
requestRemote.prototype.changeDisconnPlayerState = function (params, cb) {
  lockTable.lock({channelId: params.channelId, actionName: "changeDisconnPlayerState", data: params}, function (lockTableResponse){
    cb(lockTableResponse);
  });
};

// Set timebank details for requested player
requestRemote.prototype.setTimeBankDetails = function(params, cb) {
  lockTable.lock({channelId: params.channelId, actionName: "setTimeBankDetails", data: params}, function (lockTableResponse){
    cb(lockTableResponse);
  });
};

// <<<<<<<<<<<<<<<<<<< RPC CALLS HANDLER FINISHED >>>>>>>>>>>>>>>>>>>>>>>>>

module.exports = function (app) {
  return new requestRemote(app);
};
