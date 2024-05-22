/*jshint node: true */
"use strict";


// This file is used to validate and deduct blinds on table

var async           = require("async"),
    _               = require("underscore"),
    _ld             = require("lodash"),
    zmqPublish      = require("../../../../shared/infoPublisher"),
    stateOfX        = require("../../../../shared/stateOfX"),
    popupTextManager= require("../../../../shared/popupTextManager").falseMessages,
    popupTextManagerFromdb = require("../../../../shared/popupTextManager").dbQyeryInfo,
    activity        = require("../../../../shared/activity"),
    setMove         = require("./setMove"),
    tableManager    = require("./tableManager"),
    responseHandler = require("./responseHandler");

var deductBlinds = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'deductBlinds';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  // zmqPublish.sendLogMessage(logObject);
  console.log(JSON.stringify(logObject));
}

function fixedDecimal(number, precisionValue) {
  let precision = precisionValue ? precisionValue : 2;
  return Number(Number(number).toFixed(precision));
}

// ### Set table roundBets as 0 on game start
var setRoundBets = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in deductBlinds function setRoundBets');
  for (var i = 0; i < params.table.players.length; i++) {
    if(params.table.players[i].state === stateOfX.playerState.playing) {
      params.table.roundBets.push(parseInt(0));
    }
    serverLog(stateOfX.serverLogType.info, 'Roundbets - ' + JSON.stringify(params.table.roundBets));
  }
  cb(null, params);
};

/**
 * note contribution of player on table - first time
 * @method addContribution
 * @param  {Object}        params      contains table etc
 * @param  {Number}        playerIndex player index in array
 * @param  {Number}        amount      amount given by player - as blind etc
 * @param  {Function}      cb          callback
 */
var addContribution = function (params, playerIndex, amount, cb) {
  serverLog(stateOfX.serverLogType.info, 'Previous contributors: ' + JSON.stringify(params.table.contributors));
  if(fixedDecimal(amount, 2) > 0 ) {
    params.table.contributors.push({
      playerId  : params.table.players[playerIndex].playerId,
      amount    : amount,
      tempAmount: amount
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'Not additing contributor as amount passed is: ' + amount);
  }
  serverLog(stateOfX.serverLogType.info, 'Updated contributors: ' + JSON.stringify(params.table.contributors));
  cb();
};

// ### Deduct small blind on table
// handle if player chips are less than table small blind
var deductSmallBlind = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in deductBlinds function deductSmallBlind');
  serverLog(stateOfX.serverLogType.info, 'Round bets so far - ' + params.table.roundBets);
  if(params.table.smallBlindIndex >= 0 && !params.table.players[params.table.smallBlindIndex].isWaitingPlayer) { // extra check - sushiljainam
    var smallBlindToDeduct = fixedDecimal(params.table.smallBlind, 2);

    // Decide small blind to deduct
    serverLog(stateOfX.serverLogType.info, 'Small blind allin - ' + (params.table.players[params.table.smallBlindIndex].chips < smallBlindToDeduct));
    if(params.table.players[params.table.smallBlindIndex].chips < smallBlindToDeduct) {
      smallBlindToDeduct = fixedDecimal(params.table.players[params.table.smallBlindIndex].chips, 2);
    }
    serverLog(stateOfX.serverLogType.info, 'Small blind deducted will be - ' + smallBlindToDeduct);

    params.table.players[params.table.smallBlindIndex].chips          = params.table.players[params.table.smallBlindIndex].chips - smallBlindToDeduct;
    params.table.players[params.table.smallBlindIndex].totalRoundBet  = smallBlindToDeduct;
    params.table.players[params.table.smallBlindIndex].totalGameBet   = smallBlindToDeduct;
    params.table.roundBets[params.table.smallBlindIndex]              = smallBlindToDeduct;

    addContribution(params, params.table.smallBlindIndex, smallBlindToDeduct, function(){cb(null, params);});
  } else {
    serverLog(stateOfX.serverLogType.info, 'No small blind will deduct in this case.');
    cb(null, params);
  }
};

// ### Deduct big blind on table
// handle if player chips are less than table big blind
var deductBigBlind = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in deductBlinds function deductBigBlind');
  var bigBlindToDedect = fixedDecimal(params.table.bigBlind, 2);


  // Decide big blind to deduct
  serverLog(stateOfX.serverLogType.info, 'Big blind allin - ' + (params.table.players[params.table.bigBlindIndex].chips < bigBlindToDedect));
  if(params.table.players[params.table.bigBlindIndex].chips < bigBlindToDedect) {
    bigBlindToDedect = fixedDecimal(params.table.players[params.table.bigBlindIndex].chips, 2);
  }

  serverLog(stateOfX.serverLogType.info, 'Big blind deducted will be - ' + bigBlindToDedect);

  params.table.players[params.table.bigBlindIndex].chips         = params.table.players[params.table.bigBlindIndex].chips - bigBlindToDedect;
  params.table.players[params.table.bigBlindIndex].totalRoundBet = bigBlindToDedect;
  params.table.players[params.table.bigBlindIndex].totalGameBet  = bigBlindToDedect;
  params.table.roundBets[params.table.bigBlindIndex]             = bigBlindToDedect;
  addContribution(params, params.table.bigBlindIndex, bigBlindToDedect, function(){cb(null, params);});
};

// ### Deduct straddle amount on table
// handle if player chips are less than table straddle
var deductStraddle = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in deductBlinds function deductStraddle');
  // Deduct straddle player amount only if enable on table
  serverLog(stateOfX.serverLogType.info, 'Straddle table - ' + params.table.isStraddleEnable + ' && Straddle index - ' + params.table.straddleIndex);
  if(params.table.straddleIndex >= 0) {

    // Decide straddle amount to deduct
    var straddleToDeduct = fixedDecimal(2 * fixedDecimal(params.table.bigBlind, 2), 2);
    serverLog(stateOfX.serverLogType.info, 'Straddle allin - ' + (params.table.players[params.table.straddleIndex].chips < straddleToDeduct));
    if(params.table.players[params.table.straddleIndex].chips < straddleToDeduct) {
      straddleToDeduct = fixedDecimal(params.table.players[params.table.straddleIndex].chips, 2);
    }

    serverLog(stateOfX.serverLogType.info, 'Straddle deducted will be - ' + straddleToDeduct);

    params.table.players[params.table.straddleIndex].chips         = params.table.players[params.table.straddleIndex].chips - straddleToDeduct;
    params.table.players[params.table.straddleIndex].totalRoundBet = straddleToDeduct;
    params.table.players[params.table.straddleIndex].totalGameBet  = straddleToDeduct;
    params.table.roundBets[params.table.straddleIndex]             = straddleToDeduct;
    addContribution(params, params.table.straddleIndex, straddleToDeduct, function(){cb(null, params);});
  } else {
    serverLog(stateOfX.serverLogType.info, 'No straddle set in this game so skipping straddle amount deduction');
    cb(null, params);
  }

};

// ### Deduct forceblind for remaining playing players
var deductForceBlinds = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in deductBlinds function deductForceBlinds');

  // Return function in case of tournament
  if(params.table.channelType === stateOfX.gameType.tournament) {
    serverLog(stateOfX.serverLogType.info, 'Not deducting force blind as this table is for tournament!');
    cb(null, params);
    return;
  }

  params.table.roundContributors = params.table.contributors;
  // cb(null, params);


  async.each(_.where(params.table.players, {state: stateOfX.playerState.playing}), function(player, ecb){
    serverLog(stateOfX.serverLogType.info, 'Considering player while deducting force blind - ' + JSON.stringify(player));

    var playerIndex = _ld.findIndex(params.table.players, player);
    var forceBlindToDeduct = player.chips >= params.table.bigBlind ? params.table.bigBlind : fixedDecimal(player.chips, 2);
    if(params.table.straddleIndex >= 0){
      forceBlindToDeduct = player.chips >= (2 * params.table.bigBlind) ? (2 * params.table.bigBlind) : fixedDecimal(player.chips, 2);  // TODO
    }
    if(/*playerIndex != params.table.smallBlindIndex && */playerIndex != params.table.bigBlindIndex && playerIndex != params.table.straddleIndex) {
      serverLog(stateOfX.serverLogType.info, player.playerName + ' is not a config player, deduct force blind - ' + forceBlindToDeduct + ' !');
      if(player.isWaitingPlayer) {
        player.isWaitingPlayer                  = false;
        player.chips                            = fixedDecimal(player.chips, 2) - forceBlindToDeduct;
        player.totalRoundBet                    = forceBlindToDeduct;
        player.totalGameBet                     = forceBlindToDeduct;
        params.table.roundBets[playerIndex]     = forceBlindToDeduct;
        params.data.forceBlind[player.playerId] = forceBlindToDeduct;
        addContribution(params, playerIndex, forceBlindToDeduct, function(){});
      } else {
        serverLog(stateOfX.serverLogType.info, 'This player was already playing the game !');
      }
    } else {
      serverLog(stateOfX.serverLogType.info, 'This is a config player for this Game !');
      player.isWaitingPlayer = false;
    }
    ecb();
  }, function(err){
    if(err) {
      serverLog(stateOfX.serverLogType.info, 'Deducting force b`lind failed !');
      cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.DEDUCTFORCEBLIND_DEDUCTBLINDS, isRetry : false, isDisplay : true});
    } else {
      params.table.roundContributors = params.table.contributors;
      serverLog(stateOfX.serverLogType.info, 'Contributors - ' + JSON.stringify(params.table.contributors));
      serverLog(stateOfX.serverLogType.info, 'Round Contributors - ' + JSON.stringify(params.table.roundContributors));
      cb(null, params);
    }
  });
};

// ### Deduct ante of all players
// tournament
var deductAnte = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in deductAnte');
  params.table.roundContributors = params.table.contributors;

  // Run only in the case of tournament
  if(params.table.channelType === stateOfX.gameType.tournament) {
    async.each(_.where(params.table.players, {state: stateOfX.playerState.playing}), function(player, ecb){
      serverLog(stateOfX.serverLogType.info, 'Considering player while deducting ante - ' + JSON.stringify(player));
      var playerIndex = _ld.findIndex(params.table.players, player);
      var AnteToDeduct = player.chips >= params.table.ante ? params.table.ante : player.chips;

      // If no ante is going to deduct then skip steps
      if(AnteToDeduct > 0) {
        serverLog(stateOfX.serverLogType.info, player.playerName + ' is not a config player, deduct ante - ' + AnteToDeduct + ' !');
        player.chips                            = player.chips - AnteToDeduct;
        player.totalRoundBet                    = fixedDecimal(player.totalRoundBet, 2) + fixedDecimal(AnteToDeduct, 2);
        player.totalGameBet                     = fixedDecimal(player.totalGameBet, 2) + fixedDecimal(AnteToDeduct, 2);
        params.table.roundBets[playerIndex]     = !!params.table.roundBets[playerIndex] && params.table.roundBets[playerIndex] > 0 ? params.table.roundBets[playerIndex] + AnteToDeduct : AnteToDeduct;
        params.data.forceBlind[player.playerId] = AnteToDeduct;
        addContribution(params, playerIndex, AnteToDeduct, function(){});
      }
      ecb();
    }, function(err){
      if(err) {
        serverLog(stateOfX.serverLogType.info, 'Deducting ante failed !');
        cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.DEDUCTANTE_DEDUCTBLINNDS, isRetry : false, isDisplay : true});
      } else {
        params.table.roundContributors = params.table.contributors;
        serverLog(stateOfX.serverLogType.info, 'Contributors - ' + JSON.stringify(params.table.contributors));
        serverLog(stateOfX.serverLogType.info, 'Round Contributors - ' + JSON.stringify(params.table.roundContributors));
        cb(null, params);
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'This is not a tournament not deduction ante');
    cb(null, params);
  }
};

// ### Update entities for table here
// these keys helps in deciding further moves and calculations
var updateTableEntities = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in deductBlinds function updateTableEntities');
  // Set amount for current player in round max bet
   serverLog(stateOfX.serverLogType.info, 'Total roundBets added so far - ' + params.table.roundBets);
  if(!params.table.roundBets[params.table.currentMoveIndex]) {
    params.table.roundBets[params.table.currentMoveIndex] = parseInt(0);
    serverLog(stateOfX.serverLogType.info, 'Total roundBets set to zero for current move ' + params.table.currentMoveIndex);
  }
   serverLog(stateOfX.serverLogType.info, 'Total roundBets after update so far - ' + params.table.roundBets);

  // Set round max bet
   serverLog(stateOfX.serverLogType.info, 'Updating roundMaxBet for table.');
  // params.table.roundMaxBet = parseInt((_.max(params.table.roundBets)));
  params.table.roundMaxBet = fixedDecimal((_.max(params.table.roundBets)), 2);
   serverLog(stateOfX.serverLogType.info, 'Big blind on table on Game start - ' + params.table.bigBlind);

  params.table.minRaiseAmount     = 2*params.table.bigBlind;
  params.table.lastBetOnTable     = params.table.straddleIndex >= 0 ? 2*params.table.bigBlind : params.table.bigBlind;
  params.table.raiseDifference    = params.table.lastBetOnTable;
  params.table.lastRaiseAmount    = params.table.raiseDifference;
  params.table.considerRaiseToMax = params.table.raiseDifference;
  params.table.maxRaiseAmount     = _.max([tableManager.maxRaise(params.table), params.table.minRaiseAmount]);

  serverLog(stateOfX.serverLogType.info, 'Updated minRaiseAmount on Game start - ' + params.table.minRaiseAmount);
  serverLog(stateOfX.serverLogType.info, 'Updated maxRaiseAmount on Game start - ' + params.table.maxRaiseAmount);
  serverLog(stateOfX.serverLogType.info, 'Updated roundMaxBet on Game start - ' + params.table.roundMaxBet);

  // Change round name
  params.table.roundName = stateOfX.round.preflop;

  cb(null, params);
};

// ### Set move for first player
var setFirstPlayerMove = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in deductBlinds function setFirstPlayerMove');
  setMove.getMove(params, function (getMoveResponse){
    if(getMoveResponse.success) {
      cb(null, params);
    } else {
      cb(getMoveResponse);
    }
  });
};

// ### Decide precheks for players
var decidePlayerPrechecks = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in deductBlinds function decidePlayerPrechecks');
  setMove.assignPrechecks(params, function(assignPrechecksResponse) {
    if(assignPrechecksResponse.success) {
      params = assignPrechecksResponse.params;
      cb(null, params);
    } else {
      cb(assignPrechecksResponse);
    }
  });
};

// ### Generate response for deduct blind
var createDeductBlindResponse = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in deductBlinds function createDeductBlindResponse');
  responseHandler.setDeductBlindKeys({channelId: params.channelId, table: params.table, data: params.data}, function(setDeductBlindKeysResponse){
    cb(null, setDeductBlindKeysResponse);
  });
};

// process blind deduction on table after game has been started
deductBlinds.deduct = function (params, cb) {
  params.data.forceBlind = {};
  serverLog(stateOfX.serverLogType.info, 'in deductBlinds function deduct');
  async.waterfall([

    async.apply(setRoundBets, params),
    deductSmallBlind,
    deductBigBlind,
    deductStraddle,
    deductForceBlinds,
    deductAnte,
    updateTableEntities,
    setFirstPlayerMove,
    decidePlayerPrechecks,
    createDeductBlindResponse

  ], function(err, response){
    if(!err) {
      // activity.deductBlinds(params,stateOfX.profile.category.game,stateOfX.game.subCategory.info,stateOfX.logType.success);
      // activity.deductBlinds(params,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.info,stateOfX.logType.success);
      cb(response);
    } else {
      // activity.deductBlinds(err,stateOfX.profile.category.game,stateOfX.game.subCategory.info,stateOfX.logType.error);
      // activity.deductBlinds(err,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.info,stateOfX.logType.error);
      cb(err);
    }
  });
};

module.exports = deductBlinds;
