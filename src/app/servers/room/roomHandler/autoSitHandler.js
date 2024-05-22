/*jshint node: true */
"use strict";

// This file is used to handle auto join and sit player request

var _                = require('underscore'),
    async            = require("async"),
    _ld              = require("lodash"),
    keyValidator     = require("../../../../shared/keysDictionary"),
    imdb             = require("../../../../shared/model/inMemoryDbQuery.js"),
    // db               = require("../../../../../shared/model/dbQuery.js"),
    stateOfX         = require("../../../../shared/stateOfX.js"),
    activity         = require("../../../../shared/activity.js"),
    zmqPublish       = require("../../../../shared/infoPublisher.js"),
    popupTextManager = require("../../../../shared/popupTextManager"),
    actionLogger     = require("./actionLogger"),
    responseHandler  = require("./responseHandler"),
    commonHandler    = require("./commonHandler"),
    broadcastHandler = require("./broadcastHandler"),
    joinRequestUtil  = require("./joinRequestUtil");

    
var autoSitHandler = {};
var pomelo = require('pomelo');
const configConstants = require('../../../../shared/configConstants');
// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'autoSitHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### Store local variable used for calculations
var initializeParams = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in autoSitHandler function initializeParams');
  params.tableId          = "";
  params.channelType      = stateOfX.gameType.normal;
  params.data             = {};
  params.data.settings    = {};
  params.data.antibanking = {};
  params.data.channelId   = params.channelId;
  params.data.networkIp   = params.networkIp;
  params.data.playerId    = params.playerId;
  params.data.playerName  = params.playerName;
  params.data.seatIndex   = params.seatIndex;
  params.data.imageAvtar  = params.imageAvtar;
  params.data.deviceType  = params.deviceType;
  params.data.isPlayerSit = false;
  params.data.tableFound  = false;
  // params.session          = !!params.self.app.sessionService.getByUid(params.playerId) ? params.self.app.sessionService.getByUid(params.playerId)[0] : null;
	cb(null, params);
};

// Get table from inmemory if already exisst in database
var getInMemoryTable = function (params, cb) {
  joinRequestUtil.getInMemoryTable(params, function(getInMemoryTableResponse){
    serverLog(stateOfX.serverLogType.info, 'In autoSitHandler getInMemoryTableResponse - ', getInMemoryTableResponse);
    if(getInMemoryTableResponse.success) {
      cb(null, getInMemoryTableResponse.params);
    } else {
      cb(getInMemoryTableResponse);
    }
  });
};

// If there is no table exists in database then create new one
var createChannelInDatabase = function (params, cb) {
  joinRequestUtil.createChannelInDatabase(params, function(createChannelInDatabaseResponse){
    serverLog(stateOfX.serverLogType.info, 'In autoSitHandler createChannelInDatabaseResponse - ', createChannelInDatabaseResponse);
    cb(null, createChannelInDatabaseResponse);
  });
};


/**
 * if table is protected, user needs to join with password
 * @method rejectIfPassword
 * @param  {Object}         params data from waterfall, contains surely table
 * @param  {Function}       cb     callback
 */
var rejectIfPassword = function (params, cb) {
  // in such code style, these returns are MUST due to more code
  if(!params.table.isPrivate){
    cb(null, params); return; // PASS, table is not protected
  }
   if(!params.isRequested){
    cb(null, params); return; // PASS, if player already joined
  }
  // match with input password;
  if(params.table.password === params.password){
    cb(null, params); return; // PASS, user knows correct password
  }
  cb({success: false, isRetry: false, isDisplay: true, tableId: params.tableId, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.TABLEPASSWORDFAIL_JOINCHANNELHANDLER});
};


// Join a player into channel if not already exists
var joinPlayerToChannel = function (params, cb) {
  joinRequestUtil.joinPlayerToChannel(params, function(joinPlayerToChannelResponse){
    serverLog(stateOfX.serverLogType.info, 'In autoSitHandler joinPlayerToChannelResponse - ', joinPlayerToChannelResponse);
    cb(null, joinPlayerToChannelResponse);
  });
};

// ### Sit player based on sit preference
var sitPlayerOnTable = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in autoSitHandler function sitPlayerOnTable');
	pomelo.app.rpc.database.requestRemote.processAutoSit({}, params.data, function (processAutoSitResponse) {
		serverLog(stateOfX.serverLogType.info, 'sitPlayerOnTable processAutoSitResponse response ' + JSON.stringify(processAutoSitResponse));
    params.data.isTableFull = !!processAutoSitResponse.data && !!processAutoSitResponse.data.isTableFull ? processAutoSitResponse.data.isTableFull : false;
    if(processAutoSitResponse.success && !processAutoSitResponse.data.isTableFull) {
    	params.table             = processAutoSitResponse.table;
    	params.data.player       = processAutoSitResponse.data.player;
      params.data.seatIndex    = processAutoSitResponse.data.seatIndex; // Reset updated seat index
    	params.data.isPlayerSit  = processAutoSitResponse.data.isPlayerSit;
			cb(null, params);
    } else {
    	cb(processAutoSitResponse);
    }
  });
};

// ### Add this player as spectator for this table
var addPlayerAsSpectator = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function addPlayerAsSpectator");
  commonHandler.assignTableSettings(params, function(err, res){
    cb(err, res);
  });
};

// Set this channel into session of player
var setChannelIntoSession = function(params, cb) {
  if(!params.session) {
    serverLog(stateOfX.serverLogType.error, 'Unable to set this channelId into player session, session object missing');
    cb(null, params);
    return false;
  }

  var sessionChannels =  !!params.session.get("channels") ? params.session.get("channels") : [];

  if(sessionChannels.indexOf(params.channelId) < 0){
    sessionChannels.push(params.channelId);
  }

  params.session.set("channels", sessionChannels);
  params.session.pushAll(params.session.frontendId, params.session.id, params.session.settings, function(err,res){
      console.log('pushed session changes to frontend session');
    });
  cb(null, params);
};

// ### Broadcast player details for lobby
var broadcastLobbyDetails = function (params, cb) {
  broadcastHandler.fireBroadcastToAllSessions({app: {}, data: {_id: params.channelId, updated : {playingPlayers: params.table.players.length}, event: stateOfX.recordChange.tablePlayingPlayer}, route: stateOfX.broadcasts.tableUpdate});
  broadcastHandler.fireBroadcastToAllSessions({app: {}, data: {_id: params.channelId, playerId: params.playerId, channelType: params.channel.channelType, updated: {playerName: params.playerName, chips: params.chips}, event: stateOfX.recordChange.tableViewNewPlayer}, route: stateOfX.broadcasts.tableView});
  cb(null, params);
};


// ### Get anti banking details for this player
var getAntiBankingDetails = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function getAntiBankingDetails");
  joinRequestUtil.getAntiBanking(params, function(err, res){
    cb(err, res);
  });
};

// ### Update player state (in case of DISCONNECTED state players)
var updatePlayerState = function(params, cb) {
  pomelo.app.rpc.database.requestRemote.changeDisconnPlayerState({}, {channelId: params.channelId, playerId: params.playerId}, function (changeDisconnPlayerStateResponse) {
    serverLog(stateOfX.serverLogType.info, 'Response while updating player state from DISCONNECTED on autosit request - ' + JSON.stringify(changeDisconnPlayerStateResponse));
    if(changeDisconnPlayerStateResponse.success) {
      if(changeDisconnPlayerStateResponse.data.previousState === stateOfX.playerState.disconnected){
        serverLog(stateOfX.serverLogType.info, 'Player was in DISCONNECTED state, so firing playerState broadcast with state - ' + changeDisconnPlayerStateResponse.data.currentState);
        broadcastHandler.firePlayerStateBroadcast({channel: params.channel, channelId: params.channelId, playerId: params.playerId, state: changeDisconnPlayerStateResponse.data.currentState});
      } else {
        serverLog(stateOfX.serverLogType.info, 'Player was not in DISCONNECTED state, so skipping playerState broadcast on autosit request.');
      }
      cb(null, params);
    } else {
      cb(changeDisconnPlayerStateResponse);
    }
  });
};

// ### Store this player record in inmemory database for this join
var saveJoinRecord = function(params, cb) {
  // if(params.isRequested) {
    //console.error(params);
    imdb.upsertPlayerJoin({channelId: params.channelId, playerId: params.playerId}, {$setOnInsert: {playerName: params.playerName, channelType: params.channelType, firstJoined: Number(new Date()), observerSince: Number(new Date())}, $set: {networkIp: params.networkIp, event: 'autosit'}}, function (err, result) {
      if (err) {
        cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), tableId: params.tableId,info: popupTextManager.falseMessages.SAVEJOINRECORDFAIL_AUTOSITHANDLER + JSON.stringify(err)});
      } else {
        cb(null, params);
      }
    });
    // imdb.savePlayerJoin({channelId: params.channelId, playerId: params.playerId, playerName: params.playerName,channelType:params.channelType}, function(err, response){
    //   if(!err && response) {
    //     cb(null, params);
    //   } else {
    //     cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), tableId: params.tableId,info: popupTextManager.falseMessages.SAVEJOINRECORDFAIL_AUTOSITHANDLER + JSON.stringify(err)});
    //     //cb({success: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to store player record in join - ' + JSON.stringify(err)});
    //   }
    // });
  // } else {
    // cb(null, params);
  // }
};

// Save this record for disconnection handling
var saveActivityRecord = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "in autoSitHandler function saveActivityRecord");
  var dataToInsert = {
    channelId:  params.channelId,
    playerId:   params.playerId,
    isRequested:true,
    playerName: params.playerName,
    channelType:params.channelType,
    tableId:    params.tableId
  };
  var query = {
    playerId: params.playerId
  };
  if(!!params.channelId) {
    query.channelId = params.channelId;
  }
  if(!!params.tableId) {
    query.tableId = params.tableId;
  }
  imdb.upsertActivity(query, dataToInsert, function(err, result) {
    if(!err && !!result) {
      cb(null, params);
    } else {
      cb({success: false, isRetry: true, isDisplay: false,channelId: (params.channelId || ""), tableId: params.tableId,info: popupTextManager.falseMessages.SAVEACTIVITYRECORDFAIL_AUTOSITHANDLER});
      //cb({success: false, isDisplay: false, isRetry: true, channelId: params.channelId, tableId: params.tableId, info: 'Unable to store player activity record for disconnection handling'});
    }
  });
};

// ### Create response for autosit player
var createResponse = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in autoSitHandler function createResponse');
	responseHandler.setJoinChannelKeys(params, function(setJoinChannelKeysResponse){
		cb(null, {response: setJoinChannelKeysResponse, player: params.data.player, isTableFull: params.data.isTableFull, isPlayerSit: params.data.isPlayerSit, table: params.table, data: params.data});
	});
};

// check for same ip player already on table
// joined, sitting or in queue - anywhere
var validateSameNetwork = function (params, cb) {
  if (params.data.tableFound) {
  pomelo.app.rpc.database.tableRemote.isSameNetworkSit({}, {channelId: params.channelId, networkIp: params.networkIp, playerId: params.playerId, deviceType: params.deviceType}, function (isSameNetworkSitResponse) {
    if(isSameNetworkSitResponse.success) {
      cb(null, params);
    } else {
      cb(isSameNetworkSitResponse);
      // cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: "Someone has already joined this room from same IP."});
      // cb(null, params);
    }
  });
  } else {
    checkTableCountForPlayer(params, cb);
  }
};

// fetch a table data for validation
// mainly for password check
var getTableDataForValidation = function(params, cb){
  joinRequestUtil.getTableDataForValidation(params, function(getTableDataForValidationResponse){
    serverLog(stateOfX.serverLogType.info, "getTableDataForValidationResponse response - " + (getTableDataForValidationResponse));
    console.log("getTableDataForValidationResponse response - ", getTableDataForValidationResponse);
    if(getTableDataForValidationResponse.success) {
      cb(null, getTableDataForValidationResponse);
    } else {
      cb(getTableDataForValidationResponse);
    }
  });
};

// how many tables player has joined
// he cannont join more than 4 on system, 2 on phone
var checkTableCountForPlayer = function (params, cb) {
  imdb.playerJoinedRecord({playerId: params.playerId}, function (err, result) {
    // console.error('--------======`````',configConstants.tableCountAllowed[params.deviceType], result)
    if (result) {
      if ((result.length||0)< (configConstants.tableCountAllowed[params.deviceType]||2)) {
        cb(null, params);
      } else {
        for (var i = 0; i < result.length; i++) {
          if(result[i].channelId == params.channelId){
            return cb(null, params);
          }
        }
        return cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.CHECKTABLECOUNTFORPLAYERFAIL_TABLEMANAGER});
      }
    } else {
      cb(null, params);
    }
  });
};

// process auto sit
// - get (anyone) seat in reserved mode
// - confirm (player input) seat by adding chips in 10 seconds
autoSitHandler.processAutoSit = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'in autoSitHandler function processAutoSit');
  keyValidator.validateKeySets("Request", "connector", "processAutoSit", params, function (validated){
    if(validated.success) {
    	async.waterfall([
    		async.apply(initializeParams, params),
        getInMemoryTable,
        validateSameNetwork,
        getTableDataForValidation,
        rejectIfPassword,
    		createChannelInDatabase,
        addPlayerAsSpectator,
        updatePlayerState,
        saveJoinRecord,
        saveActivityRecord,
        sitPlayerOnTable,
        joinPlayerToChannel,
        setChannelIntoSession,
        broadcastLobbyDetails,
        getAntiBankingDetails,
    		createResponse
    	], function(err, response){
        serverLog(stateOfX.serverLogType.info, 'handler processAutoSit err ' + JSON.stringify(err));
        serverLog(stateOfX.serverLogType.info, 'handler processAutoSit response ' + JSON.stringify(response));
        if(err && !response) {
          cb(err);
          activity.playerSit(response,stateOfX.profile.category.game,stateOfX.game.subCategory.sit,stateOfX.logType.error);
    		} else {
          activity.playerSit(response,stateOfX.profile.category.game,stateOfX.game.subCategory.sit,stateOfX.logType.success);
          setTimeout(function(){
          //  broadcastHandler.fireBankruptBroadcast({self: params.self, playerId: params.playerId, channelId: params.channelId})
          }, parseInt(configConstants.autositAndBankruptDelay)*1000);
    			cb(response);
    		}
    	});
    } else {
      cb(validated);
    }
  });
};

module.exports = autoSitHandler;
