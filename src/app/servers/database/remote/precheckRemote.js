/*
* @Author: sushiljainam
* @Date:   2018-01-19 18:45:24
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-27 15:59:50
*/

/*jshint node: true */
"use strict";

var _ld = require("lodash");
var zmqPublish = require("../../../../shared/infoPublisher");
var stateOfX = require("../../../../shared/stateOfX");
var moveRemote = require("./moveRemote");
var popupTextManager = require("../../../../shared/popupTextManager");


// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'tableRemote';
  logObject.serverName   = stateOfX.serverType.database;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  // zmqPublish.sendLogMessage(logObject);
  console.log(JSON.stringify(logObject));
}

function fixedDecimal(number, precisionValue) {
  let precision = precisionValue ? precisionValue : 2;
  return Number(Number(number).toFixed(precision));
}

// when player tick/untick a precheck
// save this in table-player object when table is locked
// if player has move currently, then also execute move according to precheck
module.exports.updatePrecheckOrMakeMoveAfterLock = function (params, cb) {
  var playerIndex = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
  if(playerIndex >= 0) {
    serverLog(stateOfX.serverLogType.info, 'Initial value of ' + params.data.key + ' for player - ' + params.table.players[playerIndex].playerName + ', ' + params.table.players[playerIndex][params.data.key]);

    params.data.success = true;
    params.data.channelId = params.table.channelId;
    params.table.players[playerIndex].activityRecord.lastActivityTime = Number(new Date()); // Record last activity of player


    if (params.data.keyValues) {
      console.error("---- in precheckRemote 1111111111111", params.data.keyValues, JSON.stringify(params.table.players[playerIndex]));
      console.log(JSON.stringify(params.data.keyValues));
      console.log("-------------------" + JSON.stringify(params.table.players[playerIndex]));
      // console.log(JSON.stringify(params.table));
      Object.assign(params.table.players[playerIndex], params.data.keyValues);
      console.log("Digvijay console of updated player"+ JSON.stringify(params.table.players[playerIndex]));
      serverLog(stateOfX.serverLogType.info, 'Updated value of ' + params.data.key + ' for player - ' + params.table.players[playerIndex].playerName + ', ' + params.table.players[playerIndex][params.data.key]);
      if (params.table.state == stateOfX.gameState.running && playerIndex == params.table.currentMoveIndex) {
        console.error("---- in precheckRemote 222222222222222", params.table.state, playerIndex, params.table.currentMoveIndex);
        var decision = updateMoveActionAccToPrecheck(params, params.table.players[playerIndex]);
        console.error("---- in precheckRemote 555555555", JSON.stringify(decision));
        if (!!decision) {
          params.data.runBy = "precheck";
          var moveMsg = JSON.parse(JSON.stringify(params.data));
          moveRemote.takeAction(params, function (response) {
            console.error("---- in precheckRemote 4444444444", JSON.stringify(response));
            cb({success: true, table: params.table, data: Object.assign(params.data, {msg: moveMsg, moveResponse: response.data.response})});
          });
        } else {
          cb({success: true, table: params.table, data: params.data});
        }
      } else {
        console.error("---- in precheckRemote 3333333333333333", params.table.state, playerIndex, params.table.currentMoveIndex);
        cb({success: true, table: params.table, data: params.data});
      }
    }

  } else {
    cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SETPLAYERVALUEFAIL_TABLEMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Setting player attribute failed, player not on table!"})
  }
};

// decide move action according to
// precheck selected by player
var updateMoveActionAccToPrecheck = function (params, player) {
  var precheckValue = player.precheckValue;
  var callPCAmount = player.callPCAmount;
  var moves = player.moves;

  var decidedMove;
  switch (precheckValue) {
    case stateOfX.playerPrecheckValue.CALL :
      if (moves.indexOf(stateOfX.moveValue.call)>=0) {
        if (fixedDecimal(params.table.roundMaxBet, 2) - fixedDecimal((player.totalRoundBet||0), 2) == (player.callPCAmount||0)) {
          decidedMove = stateOfX.move.call;
        }
      }
      break;
    case stateOfX.playerPrecheckValue.CALL_ANY :
      if (moves.indexOf(stateOfX.moveValue.call)>=0) {
        decidedMove = stateOfX.move.call;
      } else if (moves.indexOf(stateOfX.moveValue.check)>=0) {
        decidedMove = stateOfX.move.check;
      } else if (moves.indexOf(stateOfX.moveValue.allin)>=0) {
        decidedMove = stateOfX.move.allin;
      }
      break;
    case stateOfX.playerPrecheckValue.FOLD :
      if (moves.indexOf(stateOfX.moveValue.fold)>=0) {
        decidedMove = stateOfX.move.fold;
      }
      break;
    case stateOfX.playerPrecheckValue.CHECK :
      if (moves.indexOf(stateOfX.moveValue.check)>=0) {
        decidedMove = stateOfX.move.check;
      }
      break;
    case stateOfX.playerPrecheckValue.ALLIN :
      if (moves.indexOf(stateOfX.moveValue.allin)>=0) {
        decidedMove = stateOfX.move.allin;
      }
      break;
    case stateOfX.playerPrecheckValue.CHECK_FOLD :
      if (moves.indexOf(stateOfX.moveValue.check)>=0) {
        decidedMove = stateOfX.move.check;
      } else if (moves.indexOf(stateOfX.moveValue.fold)>=0) {
        decidedMove = stateOfX.move.fold;
      }
      break;
    case stateOfX.playerPrecheckValue.CALL_ANY_CHECK :
      if (moves.indexOf(stateOfX.moveValue.call)>=0) {
        decidedMove = stateOfX.move.call;
      } else if (moves.indexOf(stateOfX.moveValue.check)>=0) {
        decidedMove = stateOfX.move.check;
      } else if (moves.indexOf(stateOfX.moveValue.allin)>=0) {
        decidedMove = stateOfX.move.allin;
      }
      break;
    case stateOfX.playerPrecheckValue.NONE :
      decidedMove = false;
      break;
    default: 
      decidedMove = false;
  }
  params.data.action = decidedMove;
  params.data.amount = 0;
  params.data.playerName = player.playerName;
  return decidedMove;
};

