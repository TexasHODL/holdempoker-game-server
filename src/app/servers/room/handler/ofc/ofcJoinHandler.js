/*jshint node: true */
"use strict";

// This file is used to handle channel join manipulations

var _                  = require('underscore'),
    _ld                = require("lodash"),
    async              = require("async"),
    keyValidator       = require("../../../../../shared/keysDictionary"),
    imdb               = require("../../../../../shared/model/inMemoryDbQuery.js"),
    stateOfX           = require("../../../../../shared/stateOfX.js"),
    zmqPublish         = require("../../../../../shared/infoPublisher.js"),
    ofcJoinRequestUtil = require("./ofcJoinRequestUtil"),
    ofcActionLogger    = require("./ofcActionLogger"),
    commonHandler      = require("../../roomHandler/commonHandler"),
    ofcResponseHandler = require("./ofcResponseHandler");

var ofcJoinHandler = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'ofcJoinHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// Set variables to be used for calculations

var initializeParams = function(params, cb) {
  params.data            = {};
  params.table           = null;
  params.data.tableFound = false;
  cb(null, params);
};

// Get table from inmemory if already exisst in database

var getInMemoryTable = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in ofcJoinHandler function getInMemoryTable");
  ofcJoinRequestUtil.getInMemoryTable(params, function(getInMemoryTableResponse){
    serverLog(stateOfX.serverLogType.info, "getInMemoryTable response - " + JSON.stringify(_.keys(getInMemoryTableResponse)));
    if(getInMemoryTableResponse.success) {
      cb(null, getInMemoryTableResponse);
    } else {
      cb(null, params);
    }
  });
};

// If there is no table exists in database then create new one

var createChannelInDatabase = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in ofcJoinHandler function createChannelInDatabase");
  ofcJoinRequestUtil.createChannelInDatabase(params, function(createChannelInDatabaseResponse){
    serverLog(stateOfX.serverLogType.info,'createChannelInDatabaseResponse - ' + JSON.stringify(_.keys(createChannelInDatabaseResponse)));
    cb(null, createChannelInDatabaseResponse);
  });
};

// Add player as spectator and assign settings on table as well
var addPlayerAsSpectator = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function addPlayerAsSpectator");
  commonHandler.assignTableSettings(params, function(err, res){
    cb(err, res);
  });
};

// Join a player into channel if not already exists
var joinPlayerToChannel = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in ofcJoinHandler function joinPlayerToChannel");
  ofcJoinRequestUtil.joinPlayerToChannel(params, function(joinPlayerToChannelResponse){
    cb(null, joinPlayerToChannelResponse);
  });
};

var saveJoinRecord = function(params, cb) {
  imdb.savePlayerJoin({channelId: params.channelId, playerId: params.playerId, playerName: params.playerName}, function(err, response){
    if(!err && response) {
      cb(null, params);
    } else {
      cb({success: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to store player record in join - ' + JSON.stringify(err)});
    }
  });
};

// Generate join channel response as required by client
var joinChannelKeys = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in ofcJoinHandler function joinChannelKeys");
  serverLog(stateOfX.serverLogType.info, _.keys(params));
  ofcResponseHandler.setJoinChannelKeys(params, function(setJoinChannelKeysResponse){
    params.response = setJoinChannelKeysResponse;
    cb(null, params);
  });
};

var validateKeyAndCreateLog = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in ofcJoinHandler function validateKeyAndCreateLog");
  keyValidator.validateKeySets("Response", "connector", "joinChannel", params.response, function (validated){
    if(validated.success) {
      // Create log for this event
      if(!!params.channelId) {
        ofcActionLogger.createEventLog ({self: params.self, session: params.session, channel: params.channel, data: {channelId: params.channelId, eventName: stateOfX.logEvents.joinChannel, rawData: params.response}});
      } else {
        serverLog(stateOfX.serverLogType.error, "not logging of this join as channelId missing");
      }
      cb(null, params.response);
    } else {
      cb(validated);
    }
  });
};

ofcJoinHandler.processJoin = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in ofcJoinHandler function processJoin");
  async.waterfall([
    async.apply(initializeParams, params),
    getInMemoryTable,
    createChannelInDatabase,
    addPlayerAsSpectator,
    joinPlayerToChannel,
    saveJoinRecord,
    joinChannelKeys,
    validateKeyAndCreateLog
  ], function(err, response){
    if(err) {
      cb(err);
    } else {
      cb(response);
    }
  });
};

module.exports = ofcJoinHandler;