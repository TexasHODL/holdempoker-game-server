/*jshint node: true */
"use strict";

// This file is used to handle auto join and sit player request in OFC

var _                   = require('underscore'),
    _ld                 = require("lodash"),
    async               = require("async"),
    keyValidator        = require("../../../../../shared/keysDictionary"),
    imdb                = require("../../../../../shared/model/inMemoryDbQuery.js"),
    stateOfX            = require("../../../../../shared/stateOfX.js"),
    zmqPublish          = require("../../../../../shared/infoPublisher.js"),
    ofcActionLogger     = require("./ofcActionLogger"),
    ofcResponseHandler  = require("./ofcResponseHandler"),
    ofcBroadcastHandler = require("./ofcBroadcastHandler"),
    ofcJoinRequestUtil  = require("./ofcJoinRequestUtil");

var ofcAutoSitHandler = {};
var pomelo = require('pomelo');
// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'ofcAutoSitHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### Store local variable used for calculations

var initializeParams = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in ofcAutoSitHandler function initializeParams');
  params.tableId          = "";
  params.channelType      = stateOfX.gameType.normal;
  params.data             = {};
  params.data.channelId   = params.channelId;
  params.data.playerId    = params.playerId;
  params.data.playerName  = params.playerName;
  params.data.seatIndex   = params.seatIndex;
  params.data.imageAvtar  = params.imageAvtar;
  params.data.isPlayerSit = false;
  params.data.tableFound  = false;
	cb(null, params);
};

// Get table from inmemory if already exisst in database

var getInMemoryTable = function (params, cb) {
  ofcJoinRequestUtil.getInMemoryTable(params, function(getInMemoryTableResponse){
    serverLog(stateOfX.serverLogType.info, 'In ofcAutoSitHandler getInMemoryTableResponse - ', getInMemoryTableResponse);
    cb(null, getInMemoryTableResponse);
  });
};

// If there is no table exists in database then create new one

var createChannelInDatabase = function (params, cb) {
  ofcJoinRequestUtil.createChannelInDatabase(params, function(createChannelInDatabaseResponse){
    serverLog(stateOfX.serverLogType.info, 'In ofcAutoSitHandler createChannelInDatabaseResponse - ', createChannelInDatabaseResponse);
    cb(null, createChannelInDatabaseResponse);
  });
};


// ### Join a player into channel if not already exists

// Join a player into channel if not already exists
var joinPlayerToChannel = function (params, cb) {
  ofcJoinRequestUtil.joinPlayerToChannel(params, function(joinPlayerToChannelResponse){
    serverLog(stateOfX.serverLogType.info, 'In ofcAutoSitHandler joinPlayerToChannelResponse - ', joinPlayerToChannelResponse);
    cb(null, joinPlayerToChannelResponse);
  });
};

// ### Sit player based on sit preference

var sitPlayerOnTable = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in ofcAutoSitHandler function sitPlayerOnTable');
	// params.self.app.rpc.database.requestRemote.processOFCautoSit(params.session, params.data, function (processOFCautoSitResponse) {
	// 	serverLog(stateOfX.serverLogType.info, 'sitPlayerOnTable processOFCautoSitResponse response ' + JSON.stringify(processOFCautoSitResponse));
 //    params.data.isTableFull = processOFCautoSitResponse.data.isTableFull;
 //    if(processOFCautoSitResponse.success && !processOFCautoSitResponse.data.isTableFull) {
 //    	params.table             = processOFCautoSitResponse.table;
 //    	params.data.player       = processOFCautoSitResponse.data.player;
 //    	params.data.isPlayerSit  = processOFCautoSitResponse.data.isPlayerSit;
	// 		cb(null, params);
 //    } else {
 //    	cb(processOFCautoSitResponse);
 //    }
 //  });

  pomelo.app.rpc.database.ofcRequestRemote.processOFCautoSit(params.session, {channelId: params.channelId, playerId: params.playerId, seatIndex: params.seatIndex, playerName: params.playerName , imageAvtar: params.imageAvtar, networkIp: params.networkIp, isRequested: params.isRequested}, function (processOFCautoSitResponse) {
    serverLog(stateOfX.serverLogType.info, 'processOFCautoSitResponse - ' + JSON.stringify(processOFCautoSitResponse));
    if(processOFCautoSitResponse.success) {
      if(!processOFCautoSitResponse.data.isTableFull) {
        params.isPlayerSit    = processOFCautoSitResponse.isPlayerSit;
        params.table          = processOFCautoSitResponse.table;
        params.data.player    = processOFCautoSitResponse.data.player;
        params.data.seatIndex = processOFCautoSitResponse.data.seatIndex;
        cb(null, params);
      } else {
        cb(processOFCautoSitResponse);
      }
    } else {
      cb(processOFCautoSitResponse);
    }
  });
};

// Set this channel into session of player

var setChannelIntoSession = function(params, cb) {
  var sessionChannels =  !!params.session.get("channels") ? params.session.get("channels") : [];
  sessionChannels.push(params.channelId);
  params.session.set("channels", sessionChannels);
  params.session.push("channels", function (err){
    if(err) {
      serverLog(stateOfX.serverLogType.error, 'set playerId for session service failed! error is : %j', err.stack);
      cb({success : false, channelId: params.channelId, info: err});
    } else {
      cb(null, params);
    }
  });
};

// ### Store this player record in inmemory database for this join

var saveJoinRecord = function(params, cb) {
  if(params.isRequested) {
    imdb.savePlayerJoin({channelId: params.channelId, playerId: params.playerId, playerName: params.playerName}, function(err, response){
      if(!err && response) {
        cb(null, params);
      } else {
        cb({success: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to store player record in join - ' + JSON.stringify(err)});
      }
    });
  } else {
    cb(null, params);
  }
};

// ### Create response for autosit player

var createResponse = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in ofcAutoSitHandler function createResponse');
	ofcResponseHandler.setJoinChannelKeys(params, function(setJoinChannelKeysResponse){
		cb(null, {success: true, response: setJoinChannelKeysResponse, player: params.data.player, isTableFull: params.data.isTableFull, isPlayerSit: params.data.isPlayerSit, table: params.table, data: params.data});
	});
};

ofcAutoSitHandler.processOFCautoSit = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in ofcAutoSitHandler function processOFCautoSit - ' + JSON.stringify(_.keys(params)));
  keyValidator.validateKeySets("Request", "connector", "processOFCautoSit", params, function (validated){
    if(validated.success) {
    	async.waterfall([
    		async.apply(initializeParams, params),
    		getInMemoryTable,
    		createChannelInDatabase,
        saveJoinRecord,
        sitPlayerOnTable,
        joinPlayerToChannel,
        setChannelIntoSession,
    		createResponse
    	], function(err, response){
        serverLog(stateOfX.serverLogType.error, 'handler processOFCautoSit err ' + JSON.stringify(err));
        serverLog(stateOfX.serverLogType.info, 'handler processOFCautoSit response ' + JSON.stringify(response));
    		if(err && !response) {
    			cb(err);
    		} else {
    			cb(response);
    		}
    	});
    } else {
      cb(validated);
    }
  });
};

module.exports = ofcAutoSitHandler;