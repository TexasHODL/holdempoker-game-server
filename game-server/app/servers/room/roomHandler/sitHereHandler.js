/*jshint node: true */
"use strict";

// This file is used to handle player sit manipulations

// ### External files and packages declaration ###
var keyValidator        = require("../../../../shared/keysDictionary"),
    profileMgmt         = require("../../../../shared/model/profileMgmt.js"),
    stateOfX            = require("../../../../shared/stateOfX"),
    activity            = require("../../../../shared/activity"),
    popupTextManager    = require("../../../../shared/popupTextManager"),
    imdb                = require("../../../../shared/model/inMemoryDbQuery.js"),
    db                  = require("../../../../shared/model/dbQuery.js"),
    zmqPublish          = require("../../../../shared/infoPublisher.js"),
    async               = require("async"),
    _                   = require("underscore"),
    actionLogger        = require("./actionLogger"),
    broadcastHandler    = require("./broadcastHandler"),
    startGameHandler    = require("./startGameHandler"),
    commonHandler       = require("./commonHandler"),
    channelTimerHandler = require("./channelTimerHandler"),
    joinRequestUtil     = require("./joinRequestUtil");

const configConstants = require('../../../../shared/configConstants');    
var sitHereHandler = {};
var pomelo = require('pomelo');
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'sitHereHandler';
  logObject.serverName   = stateOfX.serverType.connector;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### Validate if player is trying to sit with same network ip in same table
var validateSameNetwork = function (params, cb) {
  pomelo.app.rpc.database.tableRemote.isSameNetworkSit(params.session, {channelId: params.channelId, networkIp: params.networkIp, playerId: params.playerId}, function (isSameNetworkSitResponse) {
    if(isSameNetworkSitResponse.success) {
      cb(null, params);
    } else {
      cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: "Someone has already joined this room from same IP."});
      // cb(null, params);
    }
  });
};

// ###Check if player is not on table already
var isPlayerNotOnTable = function (params, cb) {
  pomelo.app.rpc.database.tableRemote.isPlayerNotOnTable(params.session, {channelId: params.channelId, playerId: params.playerId}, function (isPlayerNotOnTableResponse) {
    if(isPlayerNotOnTableResponse.success) {
      params.maxBuyIn = isPlayerNotOnTableResponse.table.maxBuyIn;
      params.isForceRit = isPlayerNotOnTableResponse.table.isForceRit;
      cb(null, params);
    } else {
      cb(isPlayerNotOnTableResponse);
    }
  });
};

// check if player not in queue
var checkWaitingList = function (params, cb) {
  pomelo.app.rpc.database.tableRemote.getTableAttrib(params.session, {channelId: params.channelId, key: "queueList"}, function (getTableAttribResponse) {
    if(getTableAttribResponse.success) {
      var queueList = getTableAttribResponse.value;
      if(queueList.length <= 0){  
        cb(null, params);
      }else{
        if(params.playerId === queueList[0].playerId){
          cb(null, params);
        }else{
          cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.ERROR_CHECKING_WAITINGLIST});
        }
      }
    } else {
      cb(getTableAttribResponse);
    }
  });
};

///////////////////////////////////////////////////
// Validate anti banking if exist with an amount //
///////////////////////////////////////////////////
var validateAntiBanking = function(params, cb) {
  joinRequestUtil.getAntiBanking(params, function(err, res){
    if(!err) { // No error in response
        console.error("anti banking check on sit ",params.data.antibanking);
      if(!params.data.antibanking.isAntiBanking) { // There is no record exists for this player in anti banking
        cb(null, params);
        return true;
      }

      params.data.buyinCheckRequired = false;
      if(params.chips < params.data.antibanking.amount) { // Validate amount
        cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.ANTIBANKINGPREVENT + params.data.antibanking.amount});
        return false;
      }
    }
    cb(null, params);
  });
};

//////////////////////////////////////////////////////////
// Check if min and max buy in allowed success on table //
//////////////////////////////////////////////////////////
var validateBuyInAllowed = function (params, cb) {
  
  // Do not check buy in range if already checked in anti banking
  if(!params.data.buyinCheckRequired) {
    cb(null, params);
    return true;
  }
  
  pomelo.app.rpc.database.tableRemote.tableBuyIn(params.session, {channelId: params.channelId}, function (tableBuyInResponse) {
    if(tableBuyInResponse.success) {
      if(params.chips > 0 && params.chips >= parseInt(tableBuyInResponse.tableMinBuyIn) && params.chips <= parseInt(tableBuyInResponse.tableMaxBuyIn)) {
        cb(null, params);
      } else {
        cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.TABLEBUYRESPONSEFAIL_SITHEREHANDLER});
        //cb({success: false, channelId: params.channelId, info: "Invalid chips buyin!"})
      }
    } else {
      cb({success: false, info: tableBuyInResponse,isRetry: false, isDisplay: false, channelId: ""});
    }
  });
};

// Check if seat is not already occupied success
var validateSeatOccupancy = function (params, cb) {
  pomelo.app.rpc.database.tableRemote.seatOccupied(params.session, {channelId: params.channelId}, function (seatOccupiedResponse) {
    if(seatOccupiedResponse.success) {
      if(params.seatIndex > 0 && seatOccupiedResponse.indexOccupied.indexOf(params.seatIndex) < 0) {
        cb(null, params);
      } else {
        cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.VALIDATESEATOCCUPANCYFAIL_SITHEREHANDLER});
        //cb({success: false, channelId: params.channelId, info: "Seat is already occupied!"})
      }
    } else {
      cb({seatOccupiedResponse});
    }
  });
};

// Check if player has sufficient amount as requested in profile
var validateProfileAmount = function (params, cb) {
  if(params.channel.channelType === stateOfX.gameType.normal) {
    pomelo.app.rpc.database.tableRemote.getTableAttrib(params.session, {channelId: params.channelId, key: "isRealMoney"}, function (getTableAttribResponse) {
      console.log("params---"+ JSON.stringify(getTableAttribResponse));
      profileMgmt.deductChips({playerId: params.playerId, isRealMoney: getTableAttribResponse.value, chips: parseInt(params.chips), channelId: params.channelId, subCategory : "Sit In", tableName : getTableAttribResponse.tableName}, function(deductChipsResponse) {
        if(deductChipsResponse.success) {
          serverLog(stateOfX.serverLogType.info,"Player chips deducted successfully on sit request!");
          console.log("here the response--"+deductChipsResponse.instantBonusAmount);
          params.instantBonusUsed = true;
          params.instantBonusAmount = deductChipsResponse.instantBonusAmount;
          cb(null,params);
        } else {
          cb(deductChipsResponse);
        }
      });
    });
  } else{
    cb(null,params);
  }
};

// ### Check if there is any antibaking entry exists for this player
// If yes then valiate buyin amount, it must be higher or equalthan anti banking entry amount
// If no then proceed player to sit on table with requested buyin amount
var checkAntiBankingEntry = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In function checkAntiBankingEntry.');
  db.getAntiBanking({playerId: params.playerId, channelId: params.channelId}, function(err, res){
    console.error("!!!!!!!!!!!!!!@((((((((((()))))))))))))))))))))))))))",stateOfX.serverLogType.info, 'Anti banking details for this player: ' + JSON.stringify(res));
    if(!err) {
      if( res != null){
         var timeRemains   = parseInt(configConstants.expireAntiBankingSeconds) + parseInt(configConstants.antiBankingBuffer) - (Number (new Date()) -  Number(res.createdAt))/1000 ;
          if(timeRemains > 0 ) {
            if(parseInt(params.chips) < parseInt(res.amount)){
            cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.ANTIBANKINGPREVENT + parseInt(res.amount), isRetry : false, isDisplay : true});  
            }else{
              cb(null, params);
            }
          } else {
            removeAntiBanking(params,function(cbdata){
              console.error(cbdata);
            });
            cb(null, params);
          } 
      }else{
        cb(null, params);
      }
    } else {
      serverLog(stateOfX.serverLogType.error, 'Unable to get anti banking details from database.');
      cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DB_GETANTIBANKING_FAIL, isRetry : false, isDisplay : false});
    }
  });
};

// remove antibanking if time got over
var removeAntiBanking = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function removeAntiBanking');
  db.removeAntiBankingEntry({playerId: params.playerId, channelId: params.channelId}, function(err, res){
    if(!err && res) {
      cb(null, params);
    } else {
      serverLog(stateOfX.serverLogType.error, 'Unable to insert anti banking details in database: ' + JSON.stringify(err));
      cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DB_REMOVEANTIBANKING_FAIL, isRetry : false, isDisplay : false});
    }
  });
};

// add player in players array
var addWaitingPlayer = function (params, cb) {
  console.log("inside add waiting player-- \n"+ params.instantBonusAmount);
  pomelo.app.rpc.database.tableRemote.addWaitingPlayer(params.session, { channelId: params.channelId, playerId: params.playerId, chips: params.chips, seatIndex: params.seatIndex, playerName: params.playerName, imageAvtar: params.imageAvtar, networkIp: params.networkIp, maxBuyIn: params.maxBuyIn, deviceType: params.deviceType, instantBonusAmount: params.instantBonusAmount, isForceRit: params.isForceRit}, function (addWaitingPlayerResponse) {
    if(addWaitingPlayerResponse.success) {
      params.player = addWaitingPlayerResponse.player;
      params.table  = addWaitingPlayerResponse.table;
      cb(null, params);
    } else {
      cb(addWaitingPlayerResponse);
    }
  });
};

// update isSitHere in record user activity
// not used anymore
var updateObserverRecord = function(params, cb) {
  serverLog(stateOfX.serverLogType.error,"going to update isSit");
  imdb.updateIsSit({playerId: params.playerId, channelId: params.channelId}, function(err, result) {
    if(!!result) {
      cb(null, params);
    } else {
      cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DB_UPDATEOBSERVERRECORD_FAIL, isRetry : false, isDisplay : false});
    }
  });
};

////////////////////////////////////////////
// ### Broadcast player details for lobby //
////////////////////////////////////////////

var broadcastLobbyDetails = function (params, cb) {
  broadcastHandler.fireBroadcastToAllSessions({app: {}, data: {_id: params.channelId, updated : {playingPlayers: params.table.players.length}, event: stateOfX.recordChange.tablePlayingPlayer}, route: stateOfX.broadcasts.tableUpdate});
  broadcastHandler.fireBroadcastToAllSessions({app: {}, data: {_id: params.channelId, playerId: params.playerId, channelType: params.channel.channelType, updated: {playerName: params.playerName, chips: params.chips}, event: stateOfX.recordChange.tableViewNewPlayer}, route: stateOfX.broadcasts.tableView});
  // Get player profile chips and broadcast to client, on sit player amount deduct from profile
  commonHandler.broadcastChips({serverId: pomelo.session.frontendId, playerId: params.playerId });
  // db.getCustomUser(params.playerId, {freeChips: 1, realChips:1}, function(err, user) {
  //   broadcastHandler.sendMessageToUser({self: params.self, msg: {playerId: params.playerId, updated: {freeChips: user.freeChips, realChips: user.realChips}}, playerId: params.playerId, route: stateOfX.broadcasts.updateProfile})
  // });
  cb(null, params);
};


// Kill reserve seat timer for this player
// > If player sit on a reserve sit
var killReserveSeatTimer = function(params, cb) {
//  console.error(params.channel);
  channelTimerHandler.killReserveSeatReferennce({playerId: params.playerId, channel: params.channel});
  channelTimerHandler.killKickToLobbyTimer({playerId: params.playerId, channel: params.channel});
  cb(null, params);
};

// Set this channel into session settings of player
var setChannelIntoSession = function(params, cb) {
  var sessionChannels =  params.session.get("channels");

  if(sessionChannels.indexOf(params.channelId) < 0){
    sessionChannels.push(params.channelId);
  }

  params.session.set("channels", sessionChannels);
  params.session.push("channels", function (err){
    if(err) {
      serverLog(stateOfX.serverLogType.error, 'set playerId for session service failed! error is : %j', err.stack);
      cb({success : false, channelId: params.channelId, info: err, isRetry: false, isDisplay: false});
    } else {
      console.error("Hellllllllll");
      console.error(sessionChannels);
      cb(null, params);
    }
  });
};

// set player auto buyin
var setPlayerAutoBuyIn = function (params, cb) {
  serverLog(stateOfX.serverLogType.info,'setPlayerAutoBuyIn');
  pomelo.app.rpc.database.tableRemote.setPlayerAttrib(params.session, {playerId: params.playerId, channelId: params.channelId, key: "isAutoReBuy", value: params.isAutoReBuy}, function (setPlayerAttribResponse) {
    if(setPlayerAttribResponse.success) {
      cb(null, params);
    } else {
      cb({setPlayerAttribResponse});
    }
  });
};

// Check if seat is not already occupied success
var validateResponse = function (params, cb) {
  params.response = {success: true, channelId: params.channelId};
  keyValidator.validateKeySets("Response", "connector", "sitHere", params.response, function (validated){
    if(validated.success) {
      cb(null, params);
    } else {
      cb({validated});
    }
  });
};


// Check if seat is not already occupied success
var logEventandStartGame = function (params, cb) {
  actionLogger.createEventLog ({ session: params.session, channel: params.channel, data: {channelId: params.channelId, eventName: stateOfX.logEvents.sit, rawData: {playerName: params.player.playerName, chips: params.player.chips}}});
  broadcastHandler.fireSitBroadcast({ channel: params.channel, channelId: params.channelId, session: params.session, player: params.player, table: params.table});
  // Call start game function to validate game start condition
  setTimeout(function(){
    startGameHandler.startGame({ session: params.session, channelId: params.channelId, channel: params.channel, eventName: stateOfX.startGameEvent.sit});
  }, parseInt(configConstants.startGameAfterStartEvent)*1000);
  cb(null, params);
};

// process SIT HERE api - all steps
sitHereHandler.processSit = function (params, cb) {
  serverLog(stateOfX.serverLogType.info,"in processSit");
  params.data                    = {};
  params.data.antibanking        = {};
  params.data.buyinCheckRequired = true;
  keyValidator.validateKeySets("Request", pomelo.app.serverType, "processSit", params, function (validated){
    if(validated.success) {
      async.waterfall([
        async.apply(validateSameNetwork, params),
        isPlayerNotOnTable,
        checkWaitingList,
        validateAntiBanking,
        validateBuyInAllowed,
        validateSeatOccupancy,
        checkAntiBankingEntry,
        validateProfileAmount,
        addWaitingPlayer,
        updateObserverRecord,
        broadcastLobbyDetails,
        killReserveSeatTimer,
        setChannelIntoSession,
        setPlayerAutoBuyIn,
        validateResponse,
        logEventandStartGame
      ], function(err, response) {
        if(!err && response) {
          params.success = true;
          activity.playerSit(response,stateOfX.profile.category.game,stateOfX.game.subCategory.sit,stateOfX.logType.success);
          cb(params);
        } else {
          activity.playerSit(response,stateOfX.profile.category.game,stateOfX.game.subCategory.sit,stateOfX.logType.error);
          cb(err);
        }
      });
    } else {
      cb(validated);
    }
  });
};

module.exports = sitHereHandler;
