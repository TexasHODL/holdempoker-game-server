/*jshint node: true */
"use strict";

// This file is used to handle channel join manipulations

var _                   = require('underscore'),
    _ld                 = require("lodash"),
    async               = require("async"),
    keyValidator        = require("../../../../shared/keysDictionary"),
    imdb                = require("../../../../shared/model/inMemoryDbQuery.js"),
    db                  = require("../../../../shared/model/dbQuery.js"),
    stateOfX            = require("../../../../shared/stateOfX.js"),
    zmqPublish          = require("../../../../shared/infoPublisher.js"),
    popupTextManager    = require("../../../../shared/popupTextManager"),
    actionLogger        = require("./actionLogger"),
    joinRequestUtil     = require("./joinRequestUtil"),
    commonHandler       = require("./commonHandler"),
    channelTimerHandler = require("./channelTimerHandler"),
    broadcastHandler    = require("./broadcastHandler"),
    responseHandler     = require("./responseHandler");

const configConstants = require('../../../../shared/configConstants');

var joinChannelHandler = {};
var pomelo = require('pomelo');
// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'joinChannelHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// Get table from inmemory if already exisst in database
var getInMemoryTable = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function getInMemoryTable");
  joinRequestUtil.getInMemoryTable(params, function(getInMemoryTableResponse){
    serverLog(stateOfX.serverLogType.info, "getInMemoryTable response - " + JSON.stringify(_.keys(getInMemoryTableResponse)));
    if(getInMemoryTableResponse.success) {
      cb(null, getInMemoryTableResponse.params);
    } else {
      cb(getInMemoryTableResponse);
    }
  });
};

// same ip player in same table not allowed
var blockSameIPinTable = function (params, cb) {
  // console.error('========-----------------', params)
  if (params.data.tableFound) {
    pomelo.app.rpc.database.tableRemote.isSameNetworkSit(params.session, {channelId: params.channelId, networkIp: params.networkIp, playerId: params.playerId, deviceType: params.deviceType}, function (isSameNetworkSitResponse) {
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

// table can not join more tables than allowed
// 4 on browser, 2 on phone
var checkTableCountForPlayer = function (params, cb) {
  imdb.playerJoinedRecord({playerId: params.playerId}, function (err, result) {
    // console.error('--------======`````',configconstants.tableCountAllowed[params.deviceType], result)
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

// bypass password
// if no password, 
// player knows password and rejoins table
var shouldBypassPassword = function(params, cb){
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function shouldBypassPassword " + params);
  console.log("in joinChannelHandler function shouldBypassPassword ", params);
  if(!params.data.tableFound){
    cb(null, params);
    return;
  }
  if(!params.table.isPrivate){
    cb(null, params);
    return;
  }
  imdb.playerJoinedRecord({playerId: params.playerId, channelId: params.channelId}, function(err, result){
    if(!err && result && result.length > 0){
      params.bypassPassword = true;
      cb(null, params);
      return;
    }
    else{
      params.bypassPassword = false;
      cb(null, params);
      return;
    }
  });
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

// If there is no table exists in database then create new one
var createChannelInDatabase = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function createChannelInDatabase" + params);
  joinRequestUtil.createChannelInDatabase(params, function(createChannelInDatabaseResponse){
    serverLog(stateOfX.serverLogType.info, "getInMemoryTable response - " + JSON.stringify(_.keys(createChannelInDatabaseResponse)));
    if(createChannelInDatabaseResponse.success) {
      cb(null, createChannelInDatabaseResponse);
    } else {
      cb(createChannelInDatabaseResponse);
    }
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
   if(params.bypassPassword){
    cb(null, params); return; // PASS, if player already joined
  }
  // match with input password;
  if(params.table.password === params.password){
    cb(null, params); return; // PASS, user knows correct password
  }
  cb({success: false, isRetry: false, isDisplay: true, tableId: params.tableId, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.TABLEPASSWORDFAIL_JOINCHANNELHANDLER});
};


// ### Add this player as spectator for this table
// > Save table level settings as well
// a) Sound
// b) Player Chat
// c) Dealer Chat
// d) Table Color
// e) Muck Winning Hand
// f) 4 Card Color Deck
var addPlayerAsSpectator = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function addPlayerAsSpectator");
  commonHandler.assignTableSettings(params, function(err, res){
    cb(err, res);
  });
};

// send braodcast on player joining the table
// table row becomes green on lobby
var broadcastOnJoinTable = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function broadcastOnJoinTable");
  broadcastHandler.sendMessageToUser({self: {}, playerId: params.playerId, serverId: params.session.frontendId, msg: {playerId: params.playerId, channelId: params.channelId, event : stateOfX.recordChange.playerJoinTable }, route: stateOfX.broadcasts.joinTableList});
  if (cb instanceof Function) {
  cb(null, params);
  }
};

// If request is for tournament then found channel for this player
// > In which this player is already playing
var getTournamentChannel = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function getTournamentChannel" + params);
  if(!!params.tableId) {
    imdb.getPlayerChannel(params.tableId, params.playerId, function(err, channel) {
      if(err || !channel) {
        // for testing purpose only have to delete this query after testing
        imdb.findChannels({tournamentId : params.tableId}, function(err, tournament) {
          if(!err) {
            serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function getTournamentChannel" + JSON.stringify(tournament));
          } else {
            serverLog(stateOfX.serverLogType.info, "ERROR IN FINDING IN MEMORY TABLE");
          }
        });
        cb({success: false, isRetry: false, tableId: params.tableId, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.GETTOURNAMENTCHANNELFAIL_JOINCHANNELHANDLER});
        //cb({success:false, channelId: (params.channelId || "") , tableId: params.tableId, info: "ERROR IN FINDING IN MEMORY TABLE"});
      } else {
        pomelo.app.rpc.database.tableRemote.getTable(params.session, {channelId: channel.channelId}, function (getTableResponse) {
          if(getTableResponse.success) {
            params.data.tableFound = true;
            params.table           = getTableResponse.table;
            params.channelId       = getTableResponse.table.channelId;
            params.channel         = pomelo.app.get('channelService').getChannel(getTableResponse.table.channelId, false);
            cb(null, params);
          } else {
            cb(getTableResponse);
          }
        });
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'This request is for normal table join !');
    cb(null, params);
  }
};

// Join a player into channel if not already exists
// add member into pomelo channel
var joinPlayerToChannel = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function joinPlayerToChannel");
  joinRequestUtil.joinPlayerToChannel(params, function(joinPlayerToChannelResponse){
    cb(null, joinPlayerToChannelResponse);
  });
};

// Save this record for disconnection handling
// not used anymore
var saveActivityRecord = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function saveActivityRecord");
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
  // serverLog(stateOfX.serverLogType.info, 'data to insert is - 'query,dataToInsert);
  imdb.upsertActivity(query, dataToInsert, function(err, result) {
    if(!err && !!result) {
      cb(null, params);
    } else {
      cb({success: false, isRetry: true, isDisplay: false,tableId: params.tableId,channelId: (params.channelId || ""), info: popupTextManager.falseMessages.DBUPSERTACTIVITYFAIL_JOINCHANNELHANDLER});
      //cb({success: false, isDisplay: false, isRetry: true, channelId: params.channelId, tableId: params.tableId, info: 'Unable to store player activity record for disconnection handling'});
    }
  });
};

// upsert join record - inmem db - tableJoinRecord
var saveJoinRecord = function(params, cb) {
  // upsertPlayerJoin
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function saveJoinRecord");
  imdb.upsertPlayerJoin({channelId: params.channelId, playerId: params.playerId}, {$setOnInsert: {playerName: params.playerName, channelType:params.channelType, firstJoined: Number(new Date()), observerSince: Number(new Date())}, $set: {networkIp: params.networkIp, event: 'join'}}, function (err, result) {
    if (err) {
      cb({success: false, isRetry: false, isDisplay: false,tableId: params.tableId,channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DBSAVEJOINRECORDFAIL_JOINCHANNELHANDLER + JSON.stringify(err)});
    } else {
      if (result && result.result && result.result.upserted) {
        params.firstJoined = true;
      }
      cb(null, params);
    }
  });
//   imdb.isPlayerJoined({channelId: params.channelId, playerId: params.playerId}, function(err, result){ // Check if
//      if(err){
//       cb({success: false, isRetry: false, isDisplay: false,tableId: params.tableId,channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DBSAVEJOINRECORDFAIL_JOINCHANNELHANDLER + JSON.stringify(err)});
//      }else{
//           if(result){
//             cb(null, params);
//           }else{
// //            console.error(params);
//              imdb.savePlayerJoin({channelId: params.channelId, playerId: params.playerId, playerName: params.playerName,channelType:params.channelType}, function(err, response){
//               if(!err && response) {
//                 cb(null, params);
//               } else {
//                 cb({success: false, isRetry: false, isDisplay: false,tableId: params.tableId,channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DBSAVEJOINRECORDFAIL_JOINCHANNELHANDLER + JSON.stringify(err)});
//                 //cb({success: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to store player record in join - ' + JSON.stringify(err)});
//                 // cb({success: false, isDisplay: false, isRetry: true, channelId: params.channelId, channelId: params.channelId, tableId: params.tableId, info: 'Unable to store player record in join - ' + JSON.stringify(err)});
//               }
//             });
//           }
//      }
//   })
  // imdb.savePlayerJoin({channelId: params.channelId, playerId: params.playerId, playerName: params.playerName}, function(err, response){
  //   if(!err && response) {
  //     cb(null, params);
  //   } else {
  //     cb({success: false, isRetry: false, isDisplay: false,tableId: params.tableId,channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DBSAVEJOINRECORDFAIL_JOINCHANNELHANDLER + JSON.stringify(err)});
  //     //cb({success: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to store player record in join - ' + JSON.stringify(err)});
  //     // cb({success: false, isDisplay: false, isRetry: true, channelId: params.channelId, channelId: params.channelId, tableId: params.tableId, info: 'Unable to store player record in join - ' + JSON.stringify(err)});
  //   }
  // });
};

// ### Update player state (in case of DISCONNECTED state players)
// player rejoins
var updatePlayerState = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function updatePlayerState");
  pomelo.app.rpc.database.requestRemote.changeDisconnPlayerState(params.session, {channelId: params.channelId, playerId: params.playerId, deviceType: params.deviceType}, function (changeDisconnPlayerStateResponse) {
    serverLog(stateOfX.serverLogType.info, 'Response while updating player state from DISCONNECTED on join - ' + JSON.stringify(changeDisconnPlayerStateResponse));
    if(changeDisconnPlayerStateResponse.success) {
      params.table = changeDisconnPlayerStateResponse.table;
      params.data = _.extend(params.data, changeDisconnPlayerStateResponse.data);
      if(changeDisconnPlayerStateResponse.data.previousState === stateOfX.playerState.disconnected){
        serverLog(stateOfX.serverLogType.info, 'Player was in DISCONNECTED state, so firing playerState broadcast with state - ' + changeDisconnPlayerStateResponse.data.currentState);
        broadcastHandler.firePlayerStateBroadcast({channel: params.channel, channelId: params.channelId, playerId: params.playerId, state: changeDisconnPlayerStateResponse.data.currentState});
      } else {
        serverLog(stateOfX.serverLogType.info, 'Player was not in DISCONNECTED state, so skipping playerState broadcast on join.');
      }
      cb(null, params);
    } else {
      cb(changeDisconnPlayerStateResponse);
    }
  });
};

// Set this channel into session of player
// in session settings, for future use
var setChannelIntoSession = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function setChannelIntoSession");
  var tempPlayer = _.where(params.table.players,{playerId: params.playerId});
  console.error(stateOfX.serverLogType.info, "player sitting on table is - " + JSON.stringify(params.table.players));
  // if(tempPlayer.length > 0) {
    serverLog(stateOfX.serverLogType.info, "channel from sessions - " + JSON.stringify(params.session.get("channels")));
    var sessionChannels =  params.session.get("channels");
    serverLog(stateOfX.serverLogType.info, "sessionChannels are in joinchannel handler before push" + JSON.stringify(sessionChannels));
    sessionChannels.push(params.channelId);
    params.session.set("channels", sessionChannels);
    params.session.push("channels", function (err){
      if(err) {
        serverLog(stateOfX.serverLogType.error, 'set new channel for session service failed! error is : %j', err.stack);
        cb({success : false, channelId: params.channelId, info: err,isRetry: false, isDisplay: false});
      } else {
        var sessionChannels =   params.session.get("channels");
        serverLog(stateOfX.serverLogType.info, "sessionChannels are in joinchannel handler after push" + JSON.stringify( params.session.get("channels")));
        cb(null, params);
      }
    });
  // } else {
  //   serverLog(stateOfX.serverLogType.info, "player not sitting already on the table");
  //   cb(null, params);
  // }
};

// ### Get anti banking details for this player
var getAntiBankingDetails = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function getAntiBankingDetails");
  joinRequestUtil.getAntiBanking(params, function(err, res){
    cb(err, res);
  });
};

// ### Generate join channel response as required by client
var joinChannelKeys = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function joinChannelKeys");
  responseHandler.setJoinChannelKeys(params, function(setJoinChannelKeysResponse){
    params.response              = setJoinChannelKeysResponse;
    params.response.isJoinedOnce = params.data.isJoinedOnce;
    params.response.firstJoined  = params.firstJoined;
    serverLog(stateOfX.serverLogType.info, 'Response keys for log: ' + JSON.stringify(params.response));
    cb(null, params);
  });
};

// ### Start timer to kick player from lobby only if player is not already sitted in NORMAL games
var startKickToLobbyTimer = function(params, cb) {

  if(params.channel.channelType === stateOfX.gameType.tournament) {
    serverLog(stateOfX.serverLogType.info, 'This is tournament channel so not starting timer for kick to lobby!');
    cb(null, params);
    return true;
  }

  var playerIndex = _ld.indexOf(params.table.players, {playerId: params.playerId});
  if(playerIndex < 0 && !!params.firstJoined) {
    channelTimerHandler.kickPlayerToLobby({session: params.session, channel: params.channel, channelId: params.channelId, playerId: params.playerId});
  } else {
    serverLog(stateOfX.serverLogType.info, "The player is already sitted, not starting kick to lobby timer.");
  }
  cb(null, params);
};

// save an action log - hand history text
var validateKeyAndCreateLog = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function validateKeyAndCreateLog");
  keyValidator.validateKeySets("Response", "connector", "joinChannel", params.response, function (validated){
    if(validated.success) {
      // Create log for this event
      if(!!params.channelId) {
        actionLogger.createEventLog ({self: {}, session: params.session, channel: params.channel, data: {channelId: params.channelId, eventName: stateOfX.logEvents.joinChannel, rawData: params.response}});
      } else {
        serverLog(stateOfX.serverLogType.error, "not logging of this join as channelId missing");
      }
      cb(null, params.response);
    } else {
      cb(validated);
    }
  });
};

// init params as emoty
var initializeParams = function(params, cb) {
  params.data             = {};
  params.data.settings    = {};
  params.data.antibanking = {};
  params.table            = null;
  params.data.tableFound  = false;
  cb(null, params);
};

// fireif player is bankrupt
var checkAndfireBankrupt = function(params, cb) {

  // Do not fire bankrupt broadcast if this is the case of tournament
  if(params.channel.channelType === stateOfX.gameType.tournament) {
    serverLog(stateOfX.serverLogType.info, 'This is tournament channel so skipping bankrupt check for requested player!');
    cb(null, params);
    return true;
  }

  var playerIndex = _ld.findIndex(params.table.players, {playerId: params.playerId});
  if(playerIndex >= 0) {
    if(params.table.players[playerIndex].state === stateOfX.playerState.reserved || params.table.players[playerIndex].state === stateOfX.playerState.outOfMoney) {
      serverLog(stateOfX.serverLogType.info, "Player state is " + params.table.players[playerIndex].state + ", so sending bankrupt broadcast.");
      setTimeout(function(){
        broadcastHandler.fireBankruptBroadcast({playerId: params.playerId, channelId: params.channelId, self: params.self});
      }, parseInt(configConstants.joinBankruptBroadcast)*1000);
      cb(null, params);
    } else {
      serverLog(stateOfX.serverLogType.info, "Player state is " + params.table.players[playerIndex].state + ", so skipping bankrupt broadcast.");
      cb(null, params);
    }
  } else {
    serverLog(stateOfX.serverLogType.info, "The player is not taken a seat on join, avoiding bankrupt broadcast.");
    cb(null, params);
  }
};

// validate request keys
var validateKeyOnJoin = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function validateKeyOnJoin");
  if(!!params.channelId || !!params.tableId) {
    cb(null, params);
  } else {
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.VALIDATEKEYONJOINFAIL_JOINCHANNELHANDLER});
    //cb({success:false, channelId: params.channelId, tableId: params.tableId, info: "Key channelId or tableId not found or contains blank value!"});
  }
};

// process join all steps
joinChannelHandler.processJoin = function (params, cb) {
  console.error(stateOfX.serverLogType.info, "in joinChannelHandler function processJoin", params);
  async.waterfall([
    async.apply(validateKeyOnJoin, params),
    initializeParams,
    getInMemoryTable,
    blockSameIPinTable,
    shouldBypassPassword,
    getTableDataForValidation,
    rejectIfPassword,
    createChannelInDatabase,
    addPlayerAsSpectator,
    broadcastOnJoinTable,
    getTournamentChannel,
    joinPlayerToChannel,
    saveActivityRecord,
    saveJoinRecord,
    updatePlayerState,
    setChannelIntoSession,
    getAntiBankingDetails,
    joinChannelKeys,
    // checkAndfireBankrupt,
    startKickToLobbyTimer,
    validateKeyAndCreateLog
  ], function(err, response){
    if(err) {
      if (err.isInside) {
        // broadcastOnJoinTable(params);
      }
      cb(err);
    } else {
      cb(response);
    }
  });
};

module.exports = joinChannelHandler;
