/*jshint node: true */
"use strict";

 // This file is used to process join request calculation
// As join can be called from multiple events
// Normal Join, Join similar table, Join players on tournament start, auto sit player after join

var _                = require('underscore'),
    _ld              = require("lodash"),
    async            = require("async"),
    keyValidator     = require("../../../../shared/keysDictionary"),
    imdb             = require("../../../../shared/model/inMemoryDbQuery.js"),
    db               = require("../../../../shared/model/dbQuery.js"),
    stateOfX         = require("../../../../shared/stateOfX.js"),
    zmqPublish       = require("../../../../shared/infoPublisher.js"),
    popupTextManager = require("../../../../shared/popupTextManager.js"),
    popupTextManagerFromdb = require("../../../../shared/popupTextManager.js").dbQyeryInfo,
    broadcastHandler = require("./broadcastHandler"),
    actionLogger     = require("./actionLogger");
const configConstants = require('../../../../shared/configConstants');

var joinRequestUtil = {};
var pomelo = require('pomelo');
// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'joinRequestUtil';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// fetch inmem table
// mark if found
joinRequestUtil.getInMemoryTable = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinRequestUtil function getInMemoryTable");
  if(!!params.channelId) {
    serverLog(stateOfX.serverLogType.info, "Channel id present, check if table is available in Channel");
    if(!!params.channel.isTable) {
      serverLog(stateOfX.serverLogType.info, 'Table for this channel is already in database!');
      pomelo.app.rpc.database.tableRemote.getTable(params.session, {channelId: params.channelId}, function (getTableResponse) {
        serverLog(stateOfX.serverLogType.info, "in joinRequestUtil function getInMemoryTable getTable response - " + JSON.stringify(getTableResponse));
        if(getTableResponse.success) {
          params.data.tableFound = true;
          params.table = getTableResponse.table;
          cb({success: true, params: params});
        } else {
          cb(getTableResponse);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info, 'No table is created for this channel, create one in next step!');
      cb({success: true, params: params});
    }
  } else {
    serverLog(stateOfX.serverLogType.info, 'This request is for tournament table join !');
    cb({success: true, params: params});
  }
};

// ### Broadcast table details to all players
// > if table is created in cache only

var broadcastTableData = function(app, table) {
  broadcastHandler.fireBroadcastToAllSessions({app: app, data: {
    _id              : table.channelId,
    updated          : {
      isRealMoney      : table.isRealMoney,
      channelName      : table.channelName,
      turnTime         : table.turnTime,
      isPotLimit       : table.isPotLimit,
      maxPlayers       : table.maxPlayers,
      minPlayers       : table.minPlayers,
      smallBlind       : table.smallBlind,
      bigBlind         : table.bigBlind,
      minBuyIn         : table.minBuyIn,
      maxBuyIn         : table.maxBuyIn,
      channelVariation : table.channelVariation,
      channelType      : table.channelType
    },
    event            : stateOfX.recordChange.tableNewValues 
  }, route: stateOfX.broadcasts.tableUpdate});
};

// table not found in inmem db
// create it by copying wiredTiger table object
// save keys also in pomelo channel object
joinRequestUtil.createChannelInDatabase = function (params, cb) {
  params.success = true;
  serverLog(stateOfX.serverLogType.info, "in joinRequestUtil function createChannelInDatabase - " + JSON.stringify(params.data));
  if(!!params.channelId) {
    if(!params.data.tableFound) {
      serverLog(stateOfX.serverLogType.info, 'Creating new table into database for this channel!');
      pomelo.app.rpc.database.channelRemote.processSearch(params.session, {channelId: params.channelId, channelType: params.channelType, tableId: params.tableId, playerId: params.playerId,gameVersionCount: params.gameVersionCount}, function (channelRemoteResponse) {
        if(channelRemoteResponse.success) {
          channelRemoteResponse.channelDetails.serverId = pomelo.app.get('serverId');
          pomelo.app.rpc.database.tableRemote.createTable(params.session, channelRemoteResponse.channelDetails, function (createTableResponse) {
            if(createTableResponse.success) {
              params.data.tableFound                   = true;
              params.table                             = createTableResponse.table;
              
              // Set channel level variables
              params.channel.isTable                   = true;
              params.channel.roundId                   = "";
              params.channel.channelType               = params.table.channelType;
              params.channel.channelName               = params.table.channelName;
              params.channel.channelVariation          = params.table.channelVariation;
              params.channel.tournamentId              = "";
              params.channel.turnTimeReference         = null;
              params.channel.extraTurnTimeReference    = null;
              params.channel.timeBankTurnTimeReference = null;
              params.channel.clientConnAckReference    = null;
              params.channel.reserveSeatTimeReference  = [];
              params.channel.kickPlayerToLobby         = [];
              params.channel.gameStartEventSet         = stateOfX.startGameEventOnChannel.idle;
              params.channel.gameStartEventName        = null;
              params.channel.allInOccuredOnChannel     = false;
              params.channel.turnTime                  = params.table.turnTime;

              // Broadcast table details to each connected players
              broadcastTableData(pomelo.app, params.table);

              cb(params);
            } else {
              serverLog(stateOfX.serverLogType.error, 'Error while generating table!');
              params.success = false;
              cb(createTableResponse);
            }
          });
        } else {
          params.success = false;
          cb(channelRemoteResponse);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info, 'Table from inmemory database already found for this request!');
      cb(params);
    }
  } else {
    serverLog(stateOfX.serverLogType.info, 'This request is for tournament table join !');
    cb(params);
  }
};

///////////////////////////////////
// Join player to pomelo channel //
///////////////////////////////////
joinRequestUtil.joinPlayerToChannel = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinRequestUtil function joinPlayerToChannel");
  keyValidator.validateKeySets("Request", "connector", "joinPlayerToChannel", params, function (validated){
    if(validated.success) {
      // Check if player doesn't exists in the channel already
      var channelMembers = params.channel.getMembers();
      serverLog(stateOfX.serverLogType.info, "channel members are  previous- " + JSON.stringify(params.channel.getMembers()));
      if(channelMembers.indexOf(params.playerId) >= 0) {
        params.channel.leave(params.playerId);
      } else { // can be removed if log not important
        serverLog(stateOfX.serverLogType.info, 'Player is already present in pomelo channel, not adding here!');
      }
        params.channel.add(params.playerId, params.session.frontendId);
      serverLog(stateOfX.serverLogType.info, "channel members are  after- " + JSON.stringify(params.channel.getMembers()));
      cb(params);
    } else {
      cb(validated);
    }
  });
};

//////////////////////////////////////////////////////////////////////
// Get anti banking details for player who requested to join a room //
//////////////////////////////////////////////////////////////////////
joinRequestUtil.getAntiBanking = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, "in joinRequestUtil function getAntiBanking");
  db.getAntiBanking({playerId: params.playerId, channelId: params.channelId}, function(err, res){
    serverLog(stateOfX.serverLogType.info, 'Anti banking details for this player: ' + JSON.stringify(res));
    if(!err) {
      if(!!res) {
        serverLog(stateOfX.serverLogType.info, 'Remaining anti banking time: ' + ((Number (new Date()) -  Number(res.createdAt))/1000));
      }
      params.data.antibanking.isAntiBanking = !!res ? true : false;
      params.data.antibanking.amount        = !!res ? parseInt(res.amount) : -1;
      params.data.antibanking.timeRemains   = !!res ? parseInt(configConstants.expireAntiBankingSeconds) + parseInt(configConstants.antiBankingBuffer) - (Number (new Date()) -  Number(res.createdAt))/1000 : -1;
      if(params.data.antibanking.timeRemains <=0 ){
         params.data.antibanking.isAntiBanking = false;
         params.data.antibanking.amount        = -1;
          params.data.antibanking.timeRemains   = -1;
         removeAntiBanking(params,function(cb){
          console.error(cb);
         });
      }
      cb(null, params);
    } else {
      serverLog(stateOfX.serverLogType.error, popupTextManager.dbQyeryInfo.DB_GETANTIBANKING_FAIL);
      cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DB_GETANTIBANKING_FAIL, isRetry : false, isDisplay : false});
    }
  });
};

// remove antibanking data from db
var removeAntiBanking = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in join room function removeAntiBanking');
  db.removeAntiBankingEntry({playerId: params.data.playerId, channelId: params.channelId}, function(err, res){
    if(!err && res) {
      cb(null, params);
    } else {
      serverLog(stateOfX.serverLogType.error, 'Unable to insert anti banking details in database: ' + JSON.stringify(err));
      cb({success: false, channelId: (params.channelId || ""), info: popupTextManagerFromdb.DB_REMOVEANTIBANKING_FAIL, isRetry : false, isDisplay : false});
    }
  });
};

// get table data for password validation
joinRequestUtil.getTableDataForValidation = function(params, cb){
  serverLog(stateOfX.serverLogType.info, "in joinChannelHandler function getTableDataForValidation " + params);
  console.log("in joinChannelHandler function getTableDataForValidation ", params);
  if(params.data.tableFound){
    params.success = true;
    cb(params);
    return;
  }
  db.findTableById(params.channelId, function(err, result){
    console.log("err, result ", err, result);
    if(!err && result){
      result.isPrivate = JSON.parse(result.isPrivateTabel);
      result.password = result.passwordForPrivate;
      params.table = result;
      params.success = true;
      cb(params);
      return ;
    } else{
      return cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.DB_CHANNEL_NOTFOUND});
    }
  });
};

module.exports = joinRequestUtil;