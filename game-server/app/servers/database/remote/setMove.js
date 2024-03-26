/*jshint node: true */
"use strict";

/* Created by Amrendra 01/07/2016 */
var _ld           = require("lodash"),
    _             = require('underscore'),
    stateOfX      = require("../../../../shared/stateOfX"),
    keyValidator  = require("../../../../shared/keysDictionary"),
    tableManager  = require("./tableManager"),
    popupTextManager  = require("../../../../shared/popupTextManager"),
    zmqPublish    = require("../../../../shared/infoPublisher"),
    async         = require("async");

function setMove() {}

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'setMove';
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

// return call amount for current turn player
var callAmount = function(table) {
  // return (parseInt(table.roundMaxBet) - parseInt(table.roundBets[table.currentMoveIndex]));
  return (fixedDecimal(table.roundMaxBet) - fixedDecimal(table.roundBets[table.currentMoveIndex]));
};

// return true if current turn player has chips more or equal than his callAmount
var enoughCallAmount = function(table, player) {
  // return (parseInt(player.chips) >= parseInt(table.roundMaxBet) - parseInt(table.roundBets[table.currentMoveIndex]));
  return (fixedDecimal(player.chips, 2) >= fixedDecimal(fixedDecimal(table.roundMaxBet, 2) - fixedDecimal(table.roundBets[table.currentMoveIndex], 2), 2));

};

// return true if current turn player has chips more or equal than min raise (minus his current bet)
var enoughRaiseAmount = function(table, player) {
  // return (parseInt(player.chips) > parseInt(table.roundMaxBet) - parseInt(table.roundBets[table.currentMoveIndex]));
  // return (parseInt(player.chips) >= table.minRaiseAmount);
  // return (parseInt(player.chips) >= (table.minRaiseAmount - parseInt(table.players[table.currentMoveIndex].totalRoundBet)));
  return (fixedDecimal(player.chips, 2) >= (fixedDecimal(table.minRaiseAmount, 2) - fixedDecimal(table.players[table.currentMoveIndex].totalRoundBet, 2)));

};

// return true if player is small blind, round on table is preflop
// this can be improved - there should be no special case of raise
var isPreflopSmallBlind = function (table, player){
  return(enoughRaiseAmount(table, player) && table.roundName === stateOfX.round.preflop && fixedDecimal(table.roundMaxBet, 2) == fixedDecimal(table.roundBets[table.bigBlindIndex], 2) && table.currentMoveIndex === table.smallBlindIndex);
};

// Insert CHECK based on condition -
// If bet placed by this player in current round is equals to max bet in the round
var assignCheck = function(table, player) {
  serverLog(stateOfX.serverLogType.info, 'Check allowed - ' + (table.roundBets[table.currentMoveIndex] == table.roundMaxBet));
  if (fixedDecimal(table.roundBets[table.currentMoveIndex], 2) == fixedDecimal(table.roundMaxBet, 2)) {
    serverLog(stateOfX.serverLogType.info, 'CHECK');
    player.moves.push(stateOfX.moveValue.check);
  }
  player.moves = _.uniq(player.moves);
  return;
};

// Insert CALL based on condition
// If player bet is less than max bet of round and
// Player has sufficient amount to add remaining amount
var assignCall = function(table, player) {
  serverLog(stateOfX.serverLogType.info, 'Call amount for this player will be - ' + callAmount(table));
  if(callAmount(table) > 0) {
    serverLog(stateOfX.serverLogType.info, table.roundMaxBet - table.roundBets[table.currentMoveIndex]);
    if(enoughCallAmount(table, player)) {
      serverLog(stateOfX.serverLogType.info, 'CALL move allowed!');
      player.moves.push(stateOfX.moveValue.call);
    }
  }
  player.moves = _.uniq(player.moves);
  return;
};

// insert BET in moves based on condition
// when roundMaxBet is zero
// player has chips more or equal than minRaise of table
var assignBet = function(table, player) {
  // if(player.moves.indexOf(stateOfX.moveValue.raise) >= 0 || parseInt(player.chips) <= 0) return;
  if (player.moves.indexOf(stateOfX.moveValue.raise) >= 0 || fixedDecimal(player.chips, 2) <= 0) return;

  // if(player.moves.indexOf(stateOfX.moveValue.allin) < 0  && (params.table.roundMaxBet == 0)) {
  // if(player.moves.indexOf(stateOfX.moveValue.raise) < 0 && ((params.table.roundMaxBet == 0) || _.max(params.table.roundBets) !== _.min(params.table.roundBets))) {
  if(fixedDecimal(table.roundBets[table.currentMoveIndex], 2) == fixedDecimal(table.roundMaxBet, 2)) {
    serverLog(stateOfX.serverLogType.info, 'BET move allowed!');
    player.moves.push(stateOfX.moveValue.bet);
  }

  player.moves = _.uniq(player.moves);
  return;
};

// insert RAISE in moves based on conditions
// when roundMaxBet is non-zero
// player has chips more or equal than minRaise of table
// and last raise was done by someone else
var assignRaise = function(table, player) {
  // If round is locked due to under raise then do not allow raise
  // to those players who have already acted

  if (table.raiseBy == player.playerId) {
    serverLog(stateOfX.serverLogType.info, 'Player last raised by him self only.');
    player.moves = _.uniq(player.moves);
    serverLog(stateOfX.serverLogType.info, 'Also set betting round locked.');
    table.isBettingRoundLocked = true;
    return;
  } else {
    serverLog(stateOfX.serverLogType.info, 'Else of if 4 in assignRaise');
  }

  if(player.isPlayed && table.isBettingRoundLocked) {
    serverLog(stateOfX.serverLogType.info, 'Not allowing raise as betting round has been locked due to under raise and player is already acted!');
    player.moves = _.uniq(player.moves);
    return;
  } else {
    serverLog(stateOfX.serverLogType.info, 'Else of if 1 in assignRaise');
  }

  // if((params.table.roundMaxBet > 0)
  // && _.max(params.table.roundBets) !== _.min(params.table.roundBets)) { // Needs to verify if this case is required or not
  if(table.roundMaxBet > 0 && enoughRaiseAmount(table, player)) {
    // <<<<<<<<< Removed equal to for case >>>>>>>>>>>>
    // SM-6, BB-50 || Game start || SM-4, BB - 46 || SM CALL 2, BB RAISE 2 || (Small blind get raise but should get allin as he doesnt
    // have enough chips to place.)
    serverLog(stateOfX.serverLogType.info, 'RAISE move allowed!');
    player.moves.push(stateOfX.moveValue.raise);
  } else {
    serverLog(stateOfX.serverLogType.info, 'Else of if 2 in assignRaise -' + JSON.stringify(table.roundMaxBet));
  }

  // Allow Raise for special case of small blind in first round
  if(player.moves.indexOf(stateOfX.moveValue.raise) < 0 && isPreflopSmallBlind(table, player)) {
    serverLog(stateOfX.serverLogType.info, 'SMALLBLIND RAISE allowed!');
    player.moves.push(stateOfX.moveValue.raise);
  } else {
    serverLog(stateOfX.serverLogType.info, 'Else of if 3 in assignRaise');
  }

  player.moves = _.uniq(player.moves);
  return;
};

// insert ALLIN in moves based on conditions
// - player has bet/raise
// -- player has less than maxRaise OR table is no-limit
// - player does not have bet/raise
// -- player has more than CALL less than minRaise, last raise was done by someone else OR
// -- player has less than CALL
var assignAllin = function(table, player) {
  if (table.raiseBy == player.playerId) {
    serverLog(stateOfX.serverLogType.info, 'Player last raised by him self only. assignAllin '+ player.moves);
    if (player.moves.indexOf(stateOfX.moveValue.call) < 0 && player.moves.indexOf(stateOfX.moveValue.check) < 0) {
      player.moves.push(stateOfX.moveValue.allin);
      serverLog(stateOfX.serverLogType.info, 'ALLIN allowed! I raised last time; someone made all in less than Min Raise but more than my chips; so I can not call but all in.');
    }
    player.moves = _.uniq(player.moves);
    return;
  } else {
    serverLog(stateOfX.serverLogType.info, 'Else of if 4 in assignAllin');
  }
  if(player.isPlayed && table.isBettingRoundLocked) {
    serverLog(stateOfX.serverLogType.info, 'Deciding allin for locked betting round and player already acted!');
    if(!enoughCallAmount(table, player)) {
      serverLog(stateOfX.serverLogType.info, 'Player doesnt have enough amount to call, allowing ALLIN.');
      player.moves.push(stateOfX.moveValue.allin);
      serverLog(stateOfX.serverLogType.info, 'ALLIN allowed!');
    } else {
      serverLog(stateOfX.serverLogType.info, 'Player have enough amount to call, not allowing ALLIN');
    }
    player.moves = _.uniq(player.moves);
    return;
  }

  console.log("inside this assign allin maxRaise value "+ tableManager.maxRaise(table));
  console.log("inside assign allin player chips "+ player.chips);
  if(tableManager.maxRaise(table) >= fixedDecimal(player.chips, 2)) {
    player.moves.push(stateOfX.moveValue.allin);
  }

  if(player.moves.indexOf(stateOfX.moveValue.call) < 0) {
    // serverLog(stateOfX.serverLogType.info, 'ALLIN allowed!')
    // if(parseInt(player.chips) >= params.table.roundMaxBet - params.table.roundBets[params.table.currentMoveIndex]) {
    //   player.moves.push(stateOfX.moveValue.allin);
    // }
  }
  player.moves = _.uniq(player.moves);
  return;
};

// remove some moves based on special game requirement cases
var removeCommonCases = function (table, player, playingPlayers, move) {
  serverLog(stateOfX.serverLogType.info, 'Removing move - ' + move);
  serverLog(stateOfX.serverLogType.info, player.moves);
  // Return if this move is not available for this player
  if(player.moves.indexOf(move) < 0) return;

  serverLog(stateOfX.serverLogType.info, 'Move exists - ' + move);

  // Remove if call is already available
  if(player.moves.indexOf(stateOfX.moveValue.call) >= 0) {
    serverLog(stateOfX.serverLogType.info, 'Call exists and removing move !');
    player.moves.splice(player.moves.indexOf(move), 1);
    return;
  }

  serverLog(stateOfX.serverLogType.info, 'Call does not exists for this player !');

  if(playingPlayers === 2 && table.roundName === stateOfX.round.preflop && table.currentMoveIndex === table.bigBlindIndex) {
    // serverLog(stateOfX.serverLogType.info, 'Removed, 2 player, preflop, big blind move');
    // player.moves.splice(player.moves.indexOf(move), 1); // Commenting as player gets only FOLD option
  }

  // serverLog(stateOfX.serverLogType.info, 'Move still not removed !');

  // In following case player will not have call option previously
  // If RAISE and ALLIN is present then remove that as well
  // 3 players, SB ALLIN, DEALER FOLD,
  if(playingPlayers >= 3 && table.roundName === stateOfX.round.preflop && table.currentMoveIndex === table.smallBlindIndex) {
    // serverLog(stateOfX.serverLogType.info, 'Removed, more than 2 players, preflop, small blind move');
    // player.moves.splice(player.moves.indexOf(move), 1); // Commenting as player gets only FOLD option
  }
  return;
};

// remove raise and allin cases based on some special cases
var removeRaiseAllin = function (params, table, player) {
  var playingPlayers  = _.where(table.players, {state: stateOfX.playerState.playing}).length;
  var activePlayers   = _.where(table.players, {state: stateOfX.playerState.playing, active: true}).length;
  var disconnectedPlayers   = _.where(table.players, {state: stateOfX.playerState.disconnected, active: true}).length;

  // Check if ALLIN or RAISE needs to be removed
  var indexOfMaxBet = table.roundBets.indexOf(table.roundMaxBet);
  if(indexOfMaxBet >= 0 && !!table.players[indexOfMaxBet] && table.players[indexOfMaxBet].lastMove === stateOfX.move.allin && playingPlayers > 2) {
    serverLog(stateOfX.serverLogType.info, 'Max bet of round placed by ALLIN player, consider as active');
    // activePlayers = activePlayers + 1;
  }

  serverLog(stateOfX.serverLogType.info, 'Player with move left - ' + tableManager.isPlayerWithMove(params));
  if((activePlayers + disconnectedPlayers) === 1 && tableManager.isPlayerWithMove(params)){
    serverLog(stateOfX.serverLogType.info, 'This is last active player of the game!');
    serverLog(stateOfX.serverLogType.info, 'Removing RAISE move!');
    removeCommonCases(table, player, playingPlayers, stateOfX.moveValue.raise);
    serverLog(stateOfX.serverLogType.info, 'Removing ALLIN move!');
    removeCommonCases(table, player, playingPlayers, stateOfX.moveValue.allin);
  } else {
    serverLog(stateOfX.serverLogType.info, 'More than 1 active player case !');
  }
};

/**
 * update player selected precheck value acc to their old precheck value and new table changes
 * @method updatePlayerPrecheckSelection
 * @param  {String}                      oldPrecheckValue          Prev selected precheck value by player
 * @param  {Number}                      newPrecheckSet            precheck set currently for player
 * @param  {Boolea}                      oldCallPCAmountStillValid true, if player's callPCAmount is still valid (or somebody has increased the roundMaxBet after his opted value)
 * @param  {Boolea}                      roundOver                 true, if round got over at prev turn
 * @return {String}                                                New precheck selected value for player
 */
var updatePlayerPrecheckSelection = function (oldPrecheckValue, newPrecheckSet, oldCallPCAmountStillValid, roundOver) {
  console.log("oldPrecheckValue " + oldPrecheckValue);
  console.log("newPrecheckSet " + newPrecheckSet);
  console.log("oldCallPCAmountStillValid " + oldCallPCAmountStillValid);
  console.log("roundOver " + roundOver);
  if (!!roundOver) {
    // reset selected precheck, when a round gets over - preflop flop turn river
    return stateOfX.playerPrecheckValue.NONE;
  }
  var newPrecheckValue;
  switch(oldPrecheckValue) {
    case stateOfX.playerPrecheckValue.NONE :
      newPrecheckValue = stateOfX.playerPrecheckValue.NONE;
      break;
    case stateOfX.playerPrecheckValue.CALL :
      if (newPrecheckSet==1) {
        newPrecheckValue = stateOfX.playerPrecheckValue.NONE;
      } else if (newPrecheckSet==2) {
        if (!!oldCallPCAmountStillValid) {
          newPrecheckValue = stateOfX.playerPrecheckValue.CALL;
        } else {
          newPrecheckValue = stateOfX.playerPrecheckValue.NONE;
        }
      } else {
        newPrecheckValue = stateOfX.playerPrecheckValue.NONE;
      }
    break;
    case stateOfX.playerPrecheckValue.CALL_ANY_CHECK : // All three cases
    case stateOfX.playerPrecheckValue.CALL_ANY :       // All three cases
    case stateOfX.playerPrecheckValue.ALLIN :          // All three cases are same
      if (newPrecheckSet==1) {
        newPrecheckValue = stateOfX.playerPrecheckValue.CALL_ANY_CHECK;
      } else if (newPrecheckSet==2) {
        newPrecheckValue = stateOfX.playerPrecheckValue.CALL_ANY;
      } else {
        newPrecheckValue = stateOfX.playerPrecheckValue.ALLIN;
      }
    break;
    case stateOfX.playerPrecheckValue.FOLD :
      if (newPrecheckSet==1) {
        newPrecheckValue = stateOfX.playerPrecheckValue.NONE;
      } else if (newPrecheckSet==2) {
        newPrecheckValue = stateOfX.playerPrecheckValue.FOLD;
      } else {
        newPrecheckValue = stateOfX.playerPrecheckValue.FOLD;
      }
      break;
    case stateOfX.playerPrecheckValue.CHECK :
      if (newPrecheckSet==1) {
        newPrecheckValue = stateOfX.playerPrecheckValue.CHECK;
      } else if (newPrecheckSet==2) {
        newPrecheckValue = stateOfX.playerPrecheckValue.NONE;
      } else {
        newPrecheckValue = stateOfX.playerPrecheckValue.NONE;
      }
    break;
    case stateOfX.playerPrecheckValue.CHECK_FOLD :
      if (newPrecheckSet==1) {
        newPrecheckValue = stateOfX.playerPrecheckValue.CHECK_FOLD;
      } else if (newPrecheckSet==2) {
        newPrecheckValue = stateOfX.playerPrecheckValue.FOLD;
      } else {
        newPrecheckValue = stateOfX.playerPrecheckValue.FOLD;
      }
      break;
    default:
      newPrecheckValue = stateOfX.playerPrecheckValue.NONE;
  }
  return newPrecheckValue;
};


// set moves for current turn player
setMove.getMove = function (params, cb) {
	keyValidator.validateKeySets("Request", "database", "getMove", params, function(validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.info, '----------In get move for a player----------');
      serverLog(stateOfX.serverLogType.info, 'currentMoveIndex - ' + params.table.currentMoveIndex);
      serverLog(stateOfX.serverLogType.info, 'player - ' + JSON.stringify(params.table.players[params.table.currentMoveIndex]));
      serverLog(stateOfX.serverLogType.info, 'roundBets - ' + params.table.roundBets);
      serverLog(stateOfX.serverLogType.info, 'roundMaxBet - ' + params.table.roundMaxBet);
      serverLog(stateOfX.serverLogType.info, 'roundName - ' + params.table.roundName);
      serverLog(stateOfX.serverLogType.info, 'This player amount - ' + params.table.roundBets[params.table.currentMoveIndex]);

      // Get player object for which moves are going to be decided
      var player = params.table.players[params.table.currentMoveIndex];
      serverLog(stateOfX.serverLogType.info, 'Moves to be decided for player - ' + JSON.stringify(player));

      // Reset this player move as blank and then start adding valid moves
      player.moves = [];

      // Insert fold as always allowed
      player.moves.push(stateOfX.moveValue.fold);

      // Start assigning moves based on conditions for that particular move
      assignCheck       (params.table, player);
      serverLog(stateOfX.serverLogType.info, 'move array after assignCheck'+ player.moves);
      assignCall        (params.table, player);
      serverLog(stateOfX.serverLogType.info, 'move array after assignCall'+ player.moves);
      assignRaise       (params.table, player);
      serverLog(stateOfX.serverLogType.info, 'move array after assignRaise'+ player.moves);
      assignBet         (params.table, player);
      serverLog(stateOfX.serverLogType.info, 'move array after assignBet'+ player.moves);
      assignAllin       (params.table, player);
      serverLog(stateOfX.serverLogType.info, 'move array after assignAllin'+ player.moves);
      removeRaiseAllin  (params, params.table, player);
      serverLog(stateOfX.serverLogType.info, 'move array after removeRaiseAllin'+ player.moves);
      serverLog(stateOfX.serverLogType.info, '----------End of get move for a player----------');

      cb({success: true, params: params});
    } else {
      cb(validated);
    }
  });
};

// assign players prechecks acc to their bets, remaining chips
// plus their selected precheck value as updated with new set of prechecks
setMove.assignPrechecks = function (params, cb) {
  var playingPlayers = _.where(params.table.players, {state: stateOfX.playerState.playing, active: true});
  serverLog(stateOfX.serverLogType.info, 'Player for whom precheck is going to decide - ' + JSON.stringify(playingPlayers));
  // Reset precheck to blank
  params.table.preChecks = [];

  // if(_.max(params.table.roundBets) != _.min(params.table.roundBets)) {
  async.each(playingPlayers, function(player, ecb) {
    // Decide individual players precheck except current player
    var playerIndex = _ld.findIndex(params.table.players, player);
    serverLog(stateOfX.serverLogType.info, 'Deciding precheck for player - ' + JSON.stringify(player));
    if(params.table.currentMoveIndex !== playerIndex) {
      if(!player.tournamentData.isTournamentSitout) {
        serverLog(stateOfX.serverLogType.info, 'Player hasnt taken move!');
        player.preCheck = stateOfX.preCheck.setThree;
        if(params.table.roundBets[playerIndex] == params.table.roundMaxBet){
          player.preCheck = stateOfX.preCheck.setOne;
        } else if((fixedDecimal(player.chips, 2) + (params.table.roundBets[playerIndex])) >= params.table.roundMaxBet){
          player.preCheck = stateOfX.preCheck.setTwo;
        }
        if (player.chips <= 0) {
          player.preCheck = -1;
        }
        // update precheck value for all players, using old precheck value and new set combination
        // player.precheckValue = updatePlayerPrecheckSelection(player.precheckValue||stateOfX.playerPrecheckValue.NONE, player.preCheck, (params.table.roundMaxBet - (player.totalRoundBet||0) == (player.callPCAmount||0)), params.data.roundOver);
        player.precheckValue = updatePlayerPrecheckSelection(player.precheckValue || stateOfX.playerPrecheckValue.NONE, player.preCheck, (fixedDecimal((fixedDecimal(params.table.roundMaxBet, 2) - fixedDecimal((player.totalRoundBet||0), 2)), 2) == fixedDecimal((player.callPCAmount||0), 2)), params.data.roundOver);
        console.log("Precheck value updated in if for player " + player.playerName + " to " + player.precheckValue);
        params.table.preChecks.push({playerId: player.playerId, set: player.preCheck, precheckValue: player.precheckValue});
        serverLog(stateOfX.serverLogType.info, 'Precheck assigned to this player - ' + JSON.stringify(player.preCheck));
        ecb();
      } else {
        serverLog(stateOfX.serverLogType.info, 'Player is in tournament sitout so not assigning precheck!');
        ecb();
      }
    } else {
      // update precheck value also for player who is gonna have current move - 
      // basically affects CALL <Amt>
      console.log("params.table.roundMaxBet " + params.table.roundMaxBet);
      console.log("player.totalRoundBet " + player.totalRoundBet);
      console.log("player.callPCAmount " + player.callPCAmount);
      console.log("old precheck value still valid " + (fixedDecimal(params.table.roundMaxBet, 2) - fixedDecimal((player.totalRoundBet || 0), 2) == fixedDecimal((player.callPCAmount || 0), 2)));
      player.precheckValue = updatePlayerPrecheckSelection(player.precheckValue||stateOfX.playerPrecheckValue.NONE, player.preCheck, (fixedDecimal((fixedDecimal(params.table.roundMaxBet, 2) - fixedDecimal((player.totalRoundBet||0), 2)), 2) == fixedDecimal((player.callPCAmount||0), 2)), params.data.roundOver);
      console.log("Precheck value updated in else for player " + player.playerName + " to " + player.precheckValue);
      serverLog(stateOfX.serverLogType.info, 'This is the player who has move, do not set prechek for this player! ' + player.precheckValue);
      ecb();
    }
  }, function(err) {
    if(err) {
      cb({success: false, isRetry: false, isDisplay: false, channelId: "", info: popupTextManager.falseMessages.ASSIGNPRECHECKS_FAIL_SETTABLECONFIG});
      //cb({success: false, info: "Precheck decision failed."})
    } else {
      serverLog(stateOfX.serverLogType.info, 'Final precheck - ' + JSON.stringify(params.table.preChecks));
      cb({success: true, params: params});
    }
  });
};

module.exports = setMove;
