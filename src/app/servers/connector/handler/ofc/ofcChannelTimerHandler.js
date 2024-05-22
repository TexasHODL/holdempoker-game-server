/*jshint node: true */
"use strict";

// This file is used to handle cases if player didn't make any move

// ### External files and packages declaration ###
var _                   = require('underscore'),
    async               = require("async"),
    schedule            = require('node-schedule'),
    keyValidator        = require("../../../../../shared/keysDictionary"),
    stateOfX            = require("../../../../../shared/stateOfX.js"),
    zmqPublish          = require("../../../../../shared/infoPublisher.js"),
    ofcBroadcastHandler = require("./ofcBroadcastHandler");
const configConstants = require('../../../../../shared/configConstants');

// var ofcChannelTimerHandler = {};

function ofcChannelTimerHandler() {}

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'ofcChannelTimerHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### Kill channel timers for moves

var killChannelLevelTimers = function (params) {
  serverLog(stateOfX.serverLogType.info, 'In ofcChannelTimerHandler function killChannelLevelTimers');
  // Kill previous timer if exists
  if(!!params.channel.turnTimeReference) {
    clearTimeout(params.channel.turnTimeReference);
    params.channel.turnTimeReference = null;
  } else {
    serverLog(stateOfX.serverLogType.error, 'OFC TURN TIMER NOT EXISTS, while restarting auto turn timer !!');
  }

  // Reset delay timer while checking client connection
  if(!!params.channel.clientConnAckReference) {
    clearTimeout(params.channel.clientConnAckReference);
    params.channel.clientConnAckReference = null;
  } else {
    serverLog(stateOfX.serverLogType.error, 'OFC TURN TIMER NOT EXISTS, while restarting auto turn timer !!');
  }
};

// ### Arrange player cards 

var arrangePlayerCards = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Round name for current player while arranging cards - ' + params.roundName);
  serverLog(stateOfX.serverLogType.info, 'Already arranged cards for current player while arranging cards - ' + JSON.stringify(params.data.currentPlayerCards));
  serverLog(stateOfX.serverLogType.info, 'Current cards to be arranged for current player while arranging cards - ' + JSON.stringify(params.data.currentCards));
  switch (params.roundName) {
    case stateOfX.ofcRound.one:
      if(params.currentCards.length >= 13) {

        params.currentCards.splice(13, params.currentCards.length);

      }
      for (var i = 0; i < params.currentCards.length; i++) {
        if(params.data.currentPlayerCards.bottom.length !== 5) {
          params.data.currentPlayerCards.bottom.push(params.currentCards[i]);
        } else if(params.data.currentPlayerCards.middle.length !== 5) {
          params.data.currentPlayerCards.middle.push(params.currentCards[i]);
        } else {
          params.data.currentPlayerCards.top.push(params.currentCards[i]);
        }
      }
      serverLog(stateOfX.serverLogType.info, 'Cards after auto arranged in round - ' + params.roundName + ' => ' + JSON.stringify(params.data.currentPlayerCards));
    break;
    
    case stateOfX.ofcRound.two:
    case stateOfX.ofcRound.three:
    case stateOfX.ofcRound.four:
    case stateOfX.ofcRound.five:
      for (var i = 0; i < (params.currentCards.length-1); i++) {
        if(params.data.currentPlayerCards.bottom.length !== 5) {
          params.data.currentPlayerCards.bottom.push(params.currentCards[i]);
        } else if(params.data.currentPlayerCards.middle.length !== 5) {
          params.data.currentPlayerCards.middle.push(params.currentCards[i]);
        } else {
          params.data.currentPlayerCards.top.push(params.currentCards[i]);
        }
      }
      params.data.discarded.push(params.currentCards[params.currentCards.length-1]);
      serverLog(stateOfX.serverLogType.info, 'Cards after auto arranged in round - ' + params.roundName + ' => ' + JSON.stringify(params.data.currentPlayerCards));
    break;
    default:
      serverLog(stateOfX.serverLogType.error, 'No handling for this case of round - ' + params.roundName);
    break;
  }
  cb(params);
};

// ### Perform any move on behalf of player from system

var perfromPlayerMove = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcChannelTimerHandler function perfromPlayerMove');
  serverLog(stateOfX.serverLogType.info, 'About to arrange cards for this player.');
  arrangePlayerCards(params, function(params){
    serverLog(stateOfX.serverLogType.info, 'About to perform move from this player.');
    params.self.ofcMakeMove({
      playerId    : params.playerId,
      channelId   : params.channelId,
      cards       : params.data.currentPlayerCards,
      discarded   : params.data.discarded,
      playerName  : params.playerName,
      isRequested : false
    }, params.session, function (makeMoveResponse) {
      cb(makeMoveResponse);
    });
  });
};

// ### Handle when player is disconnected

var autoActDisconnected = function (params) {
  serverLog(stateOfX.serverLogType.info, 'In ofcChannelTimerHandler function autoActDisconnected');
  serverLog(stateOfX.serverLogType.info, 'A timer for ' + configConstants.extraTurnTime + ' seconds has begun as extra time.');
  setTimeout(function() {
    perfromPlayerMove(params, function(performCheckOrFoldResponse) {
      serverLog(stateOfX.serverLogType.info, 'Player auto turn performed !');
    });
  }, parseInt(configConstants.extraTurnTime)*1000);
};

// ### Handle when player is connected and not making any move

var autoActConnected = function (params) {
  serverLog(stateOfX.serverLogType.info, 'No extra time will be given to this player with move.');
  perfromPlayerMove(params, function(performCheckOrFoldResponse) {
    serverLog(stateOfX.serverLogType.info, 'Player auto turn performed !');
  });
};

var validateRequestKeys = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcChannelTimerHandler function validateRequestKeys');
  keyValidator.validateKeySets("Request", "connector", "ofcStartTurnTimeOut", params, function (validated){
    if(validated.success) {
      cb(null, params);
    } else{
      cb(validated);
    }
  });
};

var getTableTurnTIme = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcChannelTimerHandler function getTableTurnTIme');
  params.self.app.rpc.database.tableRemote.getTableAttrib(params.session, {channelId: params.channelId, key: "turnTime"}, function (getTableAttribResponse) {
    serverLog(stateOfX.serverLogType.info, "getTableAttribResponse - " + JSON.stringify(getTableAttribResponse));
    if(getTableAttribResponse.success) {
      params.turnTime = getTableAttribResponse.value;
      if(params.data.isCurrentPlayerInFantasyLand) {
        params.turnTime = parseInt(stateOfX.totalOFCround) * parseInt(params.turnTime);
      }
      cb(null, params);
    } else {
      cb(getTableAttribResponse);
    }
  });
};

var killChannelTimers = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcChannelTimerHandler function killChannelTimers');
  killChannelLevelTimers(params);
  cb(null, params);
};

var setCurrentPlayerDisconnected = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcChannelTimerHandler function setCurrentPlayerDisconnected');
  params.channel.turnTimeReference = setTimeout(function() {
    params.self.app.rpc.database.tableRemote.setPlayerAttrib(params.session, {playerId: params.playerId, channelId: params.channelId, key: "state", value: stateOfX.playerState.disconnected}, function (setPlayerAttribResponse) {
      if(setPlayerAttribResponse.success) {
        cb(null, params);
      } else {
        cb(setPlayerAttribResponse);
      }
    });
  }, parseInt(params.turnTime)*1000);
};

var fireConnectionAckBroadcast = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcChannelTimerHandler function fireConnectionAckBroadcast');
  ofcBroadcastHandler.fireAckBroadcast(params);
  cb(null, params);
};

var getPlayerCurrentState = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcChannelTimerHandler function getPlayerCurrentState');
  params.channel.clientConnAckReference = setTimeout(function() {
    params.self.app.rpc.database.tableRemote.getCurrentPlayer(params.session, {channelId: params.channelId, playerId: params.playerId, key: "state"}, function (getPlayerAttributeResponse) {
      serverLog(stateOfX.serverLogType.info, 'Getting current player to verify state while automove OFC - ' + JSON.stringify(getPlayerAttributeResponse));
      if(getPlayerAttributeResponse.success) {
        params.playerState = getPlayerAttributeResponse.player.state;
        params.playerName = getPlayerAttributeResponse.player.playerName;
        cb(null, params);
      } else {
        cb(getPlayerAttributeResponse);
      }
    });
  }, 1000);
};

// Perform operation based on player current state
var performNormalTableAction = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcChannelTimerHandler function performNormalTableAction');
  serverLog(stateOfX.serverLogType.info, 'State of current player with move - ' + params.playerState);
  if(params.playerState === stateOfX.playerState.disconnected) {
    autoActDisconnected(params);
  } else {
    autoActConnected(params);
  }
  cb(null, params);
};

// ================ HANDLE TOURNAMENT CASE START HERE ======================

// ================ HANDLE TOURNAMENT CASE ENDS HERE  ======================

// ### Start timeout to handle events after a turn finished

ofcChannelTimerHandler.ofcStartTurnTimeOut = function (params) {
  serverLog(stateOfX.serverLogType.info, 'In ofcChannelTimerHandler function ofcStartTurnTimeOut');
  serverLog(stateOfX.serverLogType.info, 'params keys in ofcStartTurnTimeOut - ' + _.keys(params));
  serverLog(stateOfX.serverLogType.info, 'params.data keys in ofcStartTurnTimeOut - ' + _.keys(params.data));
  var channel                  = params.self.app.get('channelService').getChannel(params.channelId, false);
  params.channel               = channel;
  params.playerId              = !!params.data &&!!params.data.currentPlayerId ? params.data.currentPlayerId : params.response.data.currentPlayerId;
  params.currentCards          = !!params.data &&!!params.data.currentCards ? params.data.currentCards : params.response.data.currentCards;
  params.data.discarded        = [];
  params.roundName             = params.data.currentPlayerRoundName;
  params.data.foreArrangeCards = {top: [], middle: [], bottom: []};

  serverLog(stateOfX.serverLogType.info, "OFC AUTO TURN STARTED FOR " + channel.channelType + " TABLE !");
  if(channel.channelType === stateOfX.gameType.normal) {
    async.waterfall([
      async.apply(validateRequestKeys, params),
      getTableTurnTIme,
      killChannelTimers,
      setCurrentPlayerDisconnected,
      fireConnectionAckBroadcast,
      getPlayerCurrentState,
      performNormalTableAction
    ], function(err, response) {
      serverLog(stateOfX.serverLogType.error, err, response);
    });
  } else {
    serverLog(stateOfX.serverLogType.info, "No handling for auto timer in OFC " + channel.channelType + " TABLE !");
  }
};


// Schedule timer to standup player after a time crossed for reserved seat

ofcChannelTimerHandler.ofcVacantReserveSeat = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcChannelTimerHandler function ofcVacantReserveSeat');
  var currentTime = new Date();
  var scheduleTime = null;
  scheduleTime = currentTime.setSeconds(currentTime.getSeconds()+parseInt(configConstants.ofcVacantReserveSeatTime));
  params.channel.reserveSeatTimeReference[params.playerId] = schedule.scheduleJob(currentTime, function(){
    serverLog(stateOfX.serverLogType.info, 'Player will sitout auto now');
    params.self.ofcLeaveTable({self: {app: params.self.app, keepThisApp: false}, playerId: params.playerId, isStandup: true, channelId: params.channelId, isRequested: false, playerName: params.playerName}, params.session, function(){
      ofcBroadcastHandler.fireInfoBroadcastToPlayer({self: params.self, playerId: params.playerId, buttonCode: 1, channelId: params.channelId, heading: "Standup", info: "You did not act in time (" + configConstants.ofcVacantReserveSeatTime + " seconds), this seat is no longer reserved for you."});
    });
  });
};

// Kill existing timer for reserve seat

ofcChannelTimerHandler.ofcKillReserveSeatReferennce = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcChannelTimerHandler function ofcKillReserveSeatReferennce');
  if(params.channel.channelType === stateOfX.gameType.normal && params.channel.reserveSeatTimeReference[params.playerId]) {
    serverLog(stateOfX.serverLogType.info, 'Reserve seat timer exists for this player - ' + params.playerId + ', killing schedule!');
    params.channel.reserveSeatTimeReference[params.playerId].cancel();
    params.channel.reserveSeatTimeReference[params.playerId] = null;
  } else {
    serverLog(stateOfX.serverLogType.info, 'No reserve seat timer exists for player id - ' + params.playerId);
  }
};

ofcChannelTimerHandler.ofcKillChannelTurnTimer = function(params){
  killChannelLevelTimers(params);
};

module.exports = ofcChannelTimerHandler;
