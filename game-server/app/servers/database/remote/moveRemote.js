/*jshint node: true */
"use strict";

/**
* Created by Amrendra on 14/06/2016.
**/
var async                = require("async"),
  _ld                    = require("lodash"),
  _                      = require("underscore"),
  stateOfX               = require("../../../../shared/stateOfX"),
  keyValidator           = require("../../../../shared/keysDictionary"),
  db                     = require("../../../../shared/model/dbQuery.js"),
  imdb                   = require("../../../../shared/model/inMemoryDbQuery.js"),
  mongodb                = require("../../../../shared/mongodbConnection"),
  popupTextManager       = require("../../../../shared/popupTextManager").falseMessages,
  popupTextManagerFromdb = require("../../../../shared/popupTextManager").dbQyeryInfo,
  zmqPublish             = require("../../../../shared/infoPublisher"),
  activity               = require("../../../../shared/activity"),
  roundOver              = require("./utils/roundOver"),
  setMove                = require("./setMove"),
  adjustIndex            = require("./adjustActiveIndex"),
  potsplit               = require("./potsplit"),
  handleGameOver         = require("./handleGameOver"),
  responseHandler        = require("./responseHandler"),
  testSummary            = require("./utils/summaryGenerator"),
  tableManager           = require("./tableManager");

var moveRemote = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'moveRemote';
  logObject.serverName   = stateOfX.serverType.database;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  // zmqPublish.sendLogMessage(logObject);
  console.log(JSON.stringify(logObject));
}

function fixedDecimal(number, precisionValue){
  let precision = precisionValue ? precisionValue : 2;
  return Number(Number(number).toFixed(precision));
}

// ### Validate Game state to be RUNNING throughout performing move calculation

var isGameProgress = function(params, cb) {
// serverLog(stateOfX.serverLogType.info, 'In moveRemote function isGameProgress');
keyValidator.validateKeySets("Request", "database", "isGameProgress", params, function (validated){
  if(validated.success) {
    if(params.table.state === stateOfX.gameState.running) {
      cb({success: true, isGameOver: false});
    } else {
      handleGameOver.processGameOver(params, function (gameOverResponse){
        serverLog(stateOfX.serverLogType.info, 'Game over response in moveRemote - ' + JSON.stringify(gameOverResponse));
        if(gameOverResponse.success) {
          params = gameOverResponse.params;
          serverLog(stateOfX.serverLogType.info, 'Extra cards poped out - ' + JSON.stringify(params.data.remainingBoardCards));
          params.data.success           = true;
          params.data.roundOver         = true;
          params.data.isGameOver        = true;
          params.data.currentBoardCard  = params.data.remainingBoardCards;
          params.data.winners           = gameOverResponse.winners;
          params.data.rakeDeducted      = gameOverResponse.rakeDeducted;
          params.data.cardsToShow       = gameOverResponse.cardsToShow;
          serverLog(stateOfX.serverLogType.info, 'gameOverResponse.params.data.isBlindUpdated in moveRemote '+ gameOverResponse.params.data.isBlindUpdated);
          if(!!gameOverResponse.params.data.isBlindUpdated && gameOverResponse.params.data.isBlindUpdated){
            params.data.isBlindUpdated = gameOverResponse.params.data.isBlindUpdated;
          }
          serverLog(stateOfX.serverLogType.info, 'After updating the value of isBlindUpdated '+ params.data.isBlindUpdated);
          
          serverLog(stateOfX.serverLogType.info, 'Expected cards to display - '+ JSON.stringify(params.data.currentBoardCard));
          responseHandler.setActionKeys(params, function(setActionKeysResponse){
            cb(setActionKeysResponse);
          });
        } else {
          cb(gameOverResponse);
        }
      });
    }
  } else {
    cb(validated);
  }
});
};

// ### Add additional params in existing one for calculation

var initializeParams = function(params, cb) {
serverLog(stateOfX.serverLogType.info, 'In moveRemote function initializeParams: DATA: ' + JSON.stringify(params.data));
isGameProgress(params, function (isGameProgressResponse){
  if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {

    params.data        = _.omit(params.data, '__route__');
    params.data.action = params.data.action.toUpperCase();
    params.data.index  = _ld.findIndex(params.table.players, {playerId: params.data.playerId, state: stateOfX.playerState.playing});
    // Check if player is in Disconnected state
    // In case auto turn for disconnected players
    if(params.data.index < 0) {
      params.data.index = _ld.findIndex(params.table.players, {playerId: params.data.playerId, state: stateOfX.playerState.disconnected});
      serverLog(stateOfX.serverLogType.info, 'Updated player index if disconnected - ' + params.data.index);
    }
    
    // Return if no index found while performing action
    if(params.data.index < 0) {
      cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.PLAYERINDEXINMOVEFAIL + params.data.action, isRetry : false, isDisplay : true});
      return false;
    }

    // Set player state connected
    // STORY: Minor fix/ feature requirement
    // WHAT IT USED TO DO? : set player.state as playing, if it is automove from disconnected player
    // IMPACT: game starts with disconnected player
    // FIX: not doing this, (commented following if comparison and assignment)
    // if(!params.data.isRequested && params.table.players[params.data.index].state === stateOfX.playerState.disconnected) {
    //   params.table.players[params.data.index].state = stateOfX.playerState.playing;
    // }
    
    // Set Player Name
    params.data.playerName = params.table.players[params.data.index].playerName;
    // Record last activity of a player
    params.table.players[params.data.index].activityRecord.lastActivityTime = Number(new Date()); // Record last activity of player

    // Set move as ALLIN based on chips played by player
    serverLog(stateOfX.serverLogType.info, 'Move amount: ' + params.data.amount + ', player chips: ' + params.table.players[params.data.index].chips);
    // if(parseInt(params.data.amount) === parseInt(params.table.players[params.data.index].chips)) {
    // if(parseInt(params.data.amount) === (parseInt(params.table.players[params.data.index].chips)+parseInt(params.table.players[params.data.index].totalRoundBet))) {
    if (fixedDecimal(params.data.amount, 2) === (fixedDecimal(params.table.players[params.data.index].chips, 2) + fixedDecimal(params.table.players[params.data.index].totalRoundBet, 2))) {
      params.data.action = stateOfX.move.allin;
    }

    params.data.roundOver      = false;
    params.data.isGameOver     = (params.table.state === stateOfX.gameState.gameOver);
    params.data.chips          = 0;
    // params.data.amount         = parseInt(params.data.amount);
    params.data.amount         = params.data.amount;
    // params.data.originAmount   = parseInt(params.data.amount);
    params.data.originAmount   = fixedDecimal(params.data.amount, 2);
    params.data.considerAmount = params.data.amount;
    if(params.data.action === stateOfX.move.raise || params.data.action === stateOfX.move.bet || params.data.action === stateOfX.move.allin) {
      // params.data.considerAmount = parseInt(params.data.amount) - parseInt(params.table.players[params.data.index].totalRoundBet);
      // params.data.considerAmount = Number(params.data.amount) - Number(params.table.players[params.data.index].totalRoundBet);
      params.data.considerAmount = fixedDecimal(params.data.amount, 2) - fixedDecimal(params.table.players[params.data.index].totalRoundBet, 2);
    }
    params.data.pot               = _.pluck(params.table.pot, 'amount');
    params.data.roundName         = params.table.roundName;
    params.data.currentBoardCard  = [[], []];
    params.data.isCurrentPlayer   = true;
    cb(null, params);
  } else {
    cb(isGameProgressResponse);
  }
});
};

// ### Validate if the table entities set properly to start this game
var validateTableAttributeToPerformMove = function(params, cb) {
tableManager.validateEntities(params, function(err, response) {
  if(!err) {
    cb(null, params);
  } else {
    serverLog(stateOfX.serverLogType.error, ' Error while checking table config on player move  - ' + JSON.stringify(err));
    cb(err);
  }
});
};

// ### Validate if move exists for game ["CHECK", "CALL", "BET", "RAISE", "ALLIN", "FOLD"]

var isMoveExists = function(params, cb) {
serverLog(stateOfX.serverLogType.info, 'In moveRemote function isMoveExists');
isGameProgress(params, function (isGameProgressResponse){
  if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
    if(stateOfX.moves.indexOf(params.data.action) > -1) {
      cb(null, params);
    } else {
      cb({success: false, channelId: (params.channelId || ""), info: params.data.action + popupTextManager.ISMOVEEXISTS_MOVEREMOTE, isRetry : false, isDisplay : true});
      //cb({success: false, info: params.data.action + " is not a valid move!"});
    }
  } else {
    cb(isGameProgressResponse);
  }
});
};

// ### Validate player - right player to act

var validatePlayer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In moveRemote function validatePlayer');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(params.data.index >= 0) {
        if(params.table.players[params.data.index].seatIndex === params.table.players[params.table.currentMoveIndex].seatIndex) {
          cb(null, params);
        } else {
          cb({success: false, isRetry: false, isDisplay: false, channelId: params.channelId , info: popupTextManager.ISGAMEPROGRESS_VALIDATEPLAYER_MOVEREMOTE1});
          //cb({success: false, channelId: params.channelId, info: "You are not a valid player to take action!"});

        }
      } else {
        cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.ISGAMEPROGRESS_VALIDATEPLAYER_MOVEREMOTE2});
        //cb({success: false, channelId: params.channelId, info: "You are not sitting on the table!"});
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Validate move and amount
// like, FOLD with non-zero amount is invalid

var validateMoveAndAmount = function(params) {
  // Do not process if amount less than 0
  if(fixedDecimal(params.data.amount, 2) < 0) {
    console.log("1 false");
    return ({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.ISGAMEPROGRESS_SETBETAMOUNT_MOVEREMOTE5});
  }

  // Validate moves and amount for which amount should be 0
  var movesWithNoAmount = [stateOfX.move.check, stateOfX.move.fold, stateOfX.move.call];

  if(movesWithNoAmount.indexOf(params.data.action) >= 0 && fixedDecimal(params.data.amount, 2) > 0) {
    console.log("2 false");
    return ({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.ISGAMEPROGRESS_SETBETAMOUNT_MOVEREMOTE1 + params.data.amount + params.data.action});
  }

  // Validate moves and amount for which amount should not be 0
  var movesWithAmount = [stateOfX.move.bet, stateOfX.move.raise];

  if(movesWithAmount.indexOf(params.data.action) >= 0 && fixedDecimal(params.data.amount, 2) === 0) {
    console.log("3 false");
    return ({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.ISGAMEPROGRESS_SETBETAMOUNT_MOVEREMOTE1 + params.data.amount + params.data.action});
  }

  // Validate if placed amount is higher than player's on-tabe amount
  // if(params.data.amount > params.table.players[params.data.index].chips) {
  if(fixedDecimal(params.data.considerAmount, 2) > fixedDecimal(params.table.players[params.data.index].chips, 2)) {
    console.log("4 false");
    return ({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.ISGAMEPROGRESS_SETBETAMOUNT_MOVEREMOTE3});
  }

  console.log("5 true");
  return ({success: true});
};

// ### Validate if this amount is valid for this move
// > If the move is valid then set amount in case of CALL and ALLIN

var setBetAmount = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In moveRemote function setBetAmount');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      serverLog(stateOfX.serverLogType.info, 'players while setting bet amount - ' + JSON.stringify(params.table.players[params.data.index]));
      serverLog(stateOfX.serverLogType.info, 'Data for this action - ' + JSON.stringify(params.data));
      serverLog(stateOfX.serverLogType.info, 'Round max bet - ' + params.table.roundMaxBet);
      serverLog(stateOfX.serverLogType.info, 'Roundbets - ' + JSON.stringify(params.table.roundBets));

      var validate = validateMoveAndAmount(params);
      if(validate.success) {
        // Set move amount based on different conditions
        if(params.data.action === stateOfX.move.call) {
          if(params.table.roundName === stateOfX.round.preflop && params.table.currentMoveIndex != params.table.smallBlindIndex && params.table.currentMoveIndex != params.table.bigBlindIndex) {
            // TODO: Handle case when blinds ALLIN in first round and 3rd player call amount should be max of (bigBlind, maxBet)
          }
          params.data.amount         = fixedDecimal(params.table.roundMaxBet, 2) - fixedDecimal(params.table.roundBets[params.data.index], 2);
          params.data.considerAmount = fixedDecimal(params.data.amount, 2);
          cb(null, params);
          return true;
        }

        // If move is ALLIN then amount and consider amount will be equal to player's on-table chips amount
        if(params.data.action === stateOfX.move.allin) {
          params.data.amount         = params.table.players[params.data.index].chips;
          params.data.considerAmount = params.data.amount;
          cb(null, params);
          return true;
        }

      
        if(params.data.action === stateOfX.move.raise) {
          // if(params.data.amount <= (params.table.roundMaxBet - params.table.roundBets[params.data.index])) {
          serverLog(stateOfX.serverLogType.info, 'Player chips while validating raise amount' + fixedDecimal(params.table.players[params.data.index].chips));
          console.log("minRaise amount"+params.table.minRaiseAmount);
          console.log("maxRaise amount"+params.table.maxRaiseAmount);
          // Special 2 player case in PREFLOP when small blind has placed half amount already
          // But will get minimum raise double of big blind
          if(fixedDecimal(params.data.amount, 2) >= fixedDecimal(params.table.minRaiseAmount, 2) && fixedDecimal(params.data.amount, 2) <= fixedDecimal(params.table.maxRaiseAmount, 2)) {
            cb(null, params); // TODO : ERROR may be
          } else {
            cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: params.data.action +  popupTextManager.ISGAMEPROGRESS_SETBETAMOUNT_MOVEREMOTE4 + params.table.minRaiseAmount + " & "  + params.table.maxRaiseAmount + "."});
            //cb({success: false, channelId: params.channelId, info: params.data.action + " amount must be in range " + params.table.minRaiseAmount + " - " + params.table.maxRaiseAmount})
          }
          return true;
        }
        cb(null, params);
      } else {
        cb(validate);
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Validate if player has enough chips to make this bet

var validateBetAmount = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In moveRemote function validateBetAmount');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      // serverLog(stateOfX.serverLogType.info, 'Player move will be ' + params.data.action + ' with value - ' + params.data.amount);
      // if(params.table.players[params.data.index].chips >= params.data.amount) {
      if(params.table.players[params.data.index].chips >= params.data.considerAmount) {
        cb(null, params);
      } else {
        cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.ISGAMEPROGRESS_VALIDATEBETAMOUNT_MOVEREMOTE});
        //cb({success: false, channelId: params.channelId, info: "Player cannot make " + params.data.action + " with amount " + params.data.amount});
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};


// ###  Validate if current move is alloed for this player (CHECK mainly)

var validateMoveAllowed = function(params, cb) {
serverLog(stateOfX.serverLogType.info, 'In moveRemote function validateMoveAllowed');
isGameProgress(params, function (isGameProgressResponse){
  if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
    if(params.data.action === stateOfX.move.check) {
      // If this is big blind player then check allowed in first round
      // only if there is no extra bet placed in the game
      // serverLog(stateOfX.serverLogType.info, 'Round name - ' + params.table.roundName)
      // serverLog(stateOfX.serverLogType.info, 'Round bets - ' + params.table.roundBets)
      // serverLog(stateOfX.serverLogType.info, 'currentMoveIndex - ' + params.table.currentMoveIndex)
      // serverLog(stateOfX.serverLogType.info, 'Player bets in round - ' + params.table.roundBets[params.table.currentMoveIndex])
      // serverLog(stateOfX.serverLogType.info, 'Round max bet - ' + params.table.roundMaxBet)
      // serverLog(stateOfX.serverLogType.info, 'Check allowed verification - ' + (params.table.roundBets[params.table.currentMoveIndex] == params.table.roundMaxBet))
      if(params.table.roundName === stateOfX.round.preflop && (params.table.roundBets[params.table.currentMoveIndex] == params.table.roundMaxBet) && (params.data.index === params.table.bigBlindIndex)) {
        cb(null, params);
      } else {
        if(fixedDecimal(params.table.roundBets[params.table.currentMoveIndex], 2) == fixedDecimal(params.table.roundMaxBet, 2)) {
          cb(null, params);
        } else {
          cb({success: false, channelId: (params.channelId || ""),  isRetry : false, isDisplay : true, info:  params.data.action + popupTextManager.ISGAMEPROGRESS_VALIDATEMOVEALLOWED_MOVEREMOTE});
        }
      }
    } else {
      cb(null, params);
    }
  } else {
    cb(isGameProgressResponse);
  }
});
};

// ### Set player move to ALLIN if player act with his total amount

var setAllInMove = function(params, cb) {
serverLog(stateOfX.serverLogType.info, 'In moveRemote function setAllInMove');
isGameProgress(params, function (isGameProgressResponse){
  if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
    // Convert action as ALLIN if amount is equal to player's chips
    // In case of BET, and RAISE
    if(params.data.action === stateOfX.move.bet || params.data.action === stateOfX.move.raise) {
      // if(params.data.amount == (params.table.players[params.data.index].chips)) {
      if(params.data.amount == (params.table.players[params.data.index].chips + (params.table.players[params.data.index].totalRoundBet||0))) {
        serverLog(stateOfX.serverLogType.info, 'Player move set to ALLIN by bet, raise');
        params.data.action = stateOfX.move.allin;
      } else {
        serverLog(stateOfX.serverLogType.info, 'ALLIN not set as player has enough amount to play! by bet, raise');
      }
    } else if (params.data.action === stateOfX.move.call) {
      if (params.data.amount == params.table.players[params.data.index].chips) {
        serverLog(stateOfX.serverLogType.info, 'Player move set to ALLIN by call');
        params.data.action = stateOfX.move.allin;
      } else {
        serverLog(stateOfX.serverLogType.info, 'ALLIN not set as player has enough amount to play! by bet, raise');
      }
    } else {
      serverLog(stateOfX.serverLogType.info, 'ALLIN not set as action is - ' + params.data.action);
    }
    cb(null, params);
  } else {
    cb(isGameProgressResponse);
  }
});
};

// ### Update player details for this move
var updatePlayer = function(params, cb) {
serverLog(stateOfX.serverLogType.info, 'In moveRemote function updatePlayer');
isGameProgress(params, function (isGameProgressResponse){
  if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
    var player = _.findWhere(params.table.players, {playerId: params.data.playerId});
    if(!!player) { // If player exists
      serverLog(stateOfX.serverLogType.info, 'Updating player on ' + params.data.action + ': ' + JSON.stringify(player));
      if(player.active) { // If player state is playing

        // Update chips, state, lastBet, lastMove, isPlayed of this player
        // Deduct chips based on move: RAISE and BET will do not deduct amount already posted on table
        serverLog(stateOfX.serverLogType.info, 'player.chips pre ' + fixedDecimal(player.chips, 2));
        // if(params.data.action === stateOfX.move.raise || params.data.action === stateOfX.move.bet) {
        //   serverLog(stateOfX.serverLogType.info, 'amount to deduct - ' + (parseInt(params.data.amount) - parseInt(params.table.roundBets[params.data.index])));
        //   player.chips = parseInt(player.chips) - (parseInt(params.data.amount) - parseInt(params.table.roundBets[params.data.index]));
        //   player.totalRoundBet = parseInt(player.totalRoundBet) + (parseInt(params.data.amount) - parseInt(params.table.roundBets[params.data.index]));
        // } else {
        //   params.table.roundBets[params.data.index] = parseInt(params.table.roundBets[params.data.index]) + parseInt(params.data.amount);
        // }
        serverLog(stateOfX.serverLogType.info, 'amount to deduct - ' + params.data.considerAmount);
        // player.chips = parseInt(player.chips) - params.data.considerAmount;
        player.chips = fixedDecimal(player.chips, 2) - fixedDecimal(params.data.considerAmount, 2);
        // player.totalRoundBet = parseInt(player.totalRoundBet) + params.data.considerAmount;
        player.totalRoundBet = fixedDecimal(player.totalRoundBet, 2) + fixedDecimal(params.data.considerAmount, 2);
        // player.totalGameBet   = parseInt(player.totalGameBet) + params.data.considerAmount;
        player.totalGameBet = fixedDecimal(player.totalGameBet, 2) + fixedDecimal(params.data.considerAmount, 2);
        serverLog(stateOfX.serverLogType.info, 'Updated chips of player: ' + fixedDecimal(player.chips, 2));
        params.data.chips      = player.chips;
        player.lastBet = fixedDecimal(params.data.amount, 2);
        player.precheckValue   = stateOfX.playerPrecheckValue.NONE;
        player.lastMove        = params.data.action;
        player.isPlayed        = true;
        player.lastRoundPlayed = params.table.roundName;
        // player.activityRecord.lastMovePlayerAt = new Date();

        // Make this player inactive based on action
        if((params.data.action === stateOfX.move.fold) || (params.data.action === stateOfX.move.allin)) {
          serverLog(stateOfX.serverLogType.info, "This player will no longer active for this game.");
          player.active = false;
        }

        // Update player details for tournament
        if(player.tournamentData.isTimeBankUsed) {
          player.tournamentData.timeBankLeft      -= Math.ceil((Number(new Date()) - player.tournamentData.timeBankStartedAt) / 1000);
          player.tournamentData.isTimeBankUsed    = false;
          player.tournamentData.timeBankStartedAt = null;
          params.table.timeBankStartedAt          = null;
        }
        // time bank subtraction, for normal games
        if (player.isTimeBankUsed) {
          player.isTimeBankUsed = false;
          player.timeBankSec -= Math.ceil((Number(new Date()) - player.timeBankStartedAt) / 1000);
          player.timeBankSec = (player.timeBankSec < 0) ? 0 : player.timeBankSec;
          player.timeBankStartedAt = null;
        }

        serverLog(stateOfX.serverLogType.info, 'Updated player after move - ' + JSON.stringify(player));
        cb(null, params);
      } else {
        cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.ACTIVEPLAYER_ISGAMEPROGRESS_UPDATEPLAYER_MOVEREMOTE});
        //cb({success: false, channelId: params.channelId, info: 'You are in state - ' + player.state + ', with last action as - ' + player.lastMove + ' !'});
      }
    } else {
      cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.ISGAMEPROGRESS_UPDATEPLAYER_MOVEREMOTE, isRetry : false, isDisplay : true});
    }
  } else {
    cb(isGameProgressResponse);
  }
});
};

// generate text summary only on fold here
var summaryOnFold = function(params,cb){
  if(params.data.action == stateOfX.move.fold){
    testSummary.onFold(params);
  }
  cb(null,params);
};

// Set round bets and round max bets for this table

var setRoundBets = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in moveRemote function setRoundBets');
  serverLog(stateOfX.serverLogType.info, 'Action is: ' + params.data.action + ' and amount: ' + params.data.amount);
  // Do not add current amount if move is BET/RAISE
  // if(params.data.action === stateOfX.move.raise || params.data.action === stateOfX.move.bet) {
  //   params.table.roundBets[params.data.index] = parseInt(params.data.amount);
  // } else {
  // }
    // params.table.roundBets[params.data.index] = parseInt(params.table.roundBets[params.data.index]) + params.data.considerAmount;
  params.table.roundBets[params.data.index] = fixedDecimal(params.table.roundBets[params.data.index], 2) + fixedDecimal(params.data.considerAmount, 2);
  params.data.roundLastMaxBet = params.table.roundMaxBet;
  params.table.roundMaxBet = fixedDecimal(_.max(params.table.roundBets), 2);
  cb(null, params);
};


// Set all in occured for table if player move is allin
var setAllInOccured = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in moveRemote function setAllInOccured');
  if(params.data.action === stateOfX.move.allin) {
    params.table.isAllInOcccured = true;
  }
  cb(null, params);
};


// update table contributors, and amount on this table
var setTotalContributors = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in moveRemote function setTotalContributors');
  var contributorIndex = _ld.findIndex(params.table.contributors, {playerId: params.data.playerId});
  if(contributorIndex >= 0){
    serverLog(stateOfX.serverLogType.info, 'GameContri: Updating player ' + params.data.playerId  + ' contribution');
    serverLog(stateOfX.serverLogType.info, 'GameContri: Previous contribution - ' + fixedDecimal(params.table.contributors[contributorIndex].amount, 2));
    serverLog(stateOfX.serverLogType.info, 'GameContri: Amount to be added - ' + fixedDecimal(params.data.considerAmount, 2));
    serverLog(stateOfX.serverLogType.info, 'GameContri: Updated contribution will be - ' + (fixedDecimal(params.table.contributors[contributorIndex].amount) + fixedDecimal(params.data.considerAmount)));
    // params.table.contributors[contributorIndex].amount      = parseInt(params.table.contributors[contributorIndex].amount) + parseInt(params.data.considerAmount);
    params.table.contributors[contributorIndex].amount = fixedDecimal(params.table.contributors[contributorIndex].amount, 2) + fixedDecimal(params.data.considerAmount, 2);
    params.table.contributors[contributorIndex].tempAmount  = params.table.contributors[contributorIndex].amount;
  } else {
    params.table.contributors.push({
      playerId  : params.data.playerId,
      // amount    : parseInt(params.data.amount),
      amount    : fixedDecimal(params.data.amount, 2),
      // tempAmount: parseInt(params.data.amount)
      tempAmount: fixedDecimal(params.data.amount, 2)
    });
  }
  serverLog(stateOfX.serverLogType.info, 'GameContri: Contribution - ' + JSON.stringify(params.table.contributors));
  cb(null, params);
};


// update round contributors, and amount on this table
var setRoundContributors = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in moveRemote function setRoundContributors');
  serverLog(stateOfX.serverLogType.info, '==== Before Round contributors ===== ' + JSON.stringify(params.table.roundContributors));
  var contributorIndex = _ld.findIndex(params.table.roundContributors, {playerId: params.data.playerId});
  if(contributorIndex >= 0){
    serverLog(stateOfX.serverLogType.info, 'RoundContri: Updating player ' + params.data.playerId  + ' contribution');
    serverLog(stateOfX.serverLogType.info, 'RoundContri: Previous contribution - ' + fixedDecimal(params.table.roundContributors[contributorIndex].amount));
    serverLog(stateOfX.serverLogType.info, 'RoundContri: Amount to be added - ' + fixedDecimal(params.data.considerAmount));
    serverLog(stateOfX.serverLogType.info, 'RoundContri: Updated contribution will be - ' + (fixedDecimal(params.table.roundContributors[contributorIndex].amount) + fixedDecimal(params.data.considerAmount)));
    // params.table.roundContributors[contributorIndex].amount      = parseInt(params.table.roundContributors[contributorIndex].amount) + parseInt(params.data.considerAmount);
    params.table.roundContributors[contributorIndex].amount = fixedDecimal(params.table.roundContributors[contributorIndex].amount, 2) + fixedDecimal(params.data.considerAmount, 2);
    params.table.roundContributors[contributorIndex].tempAmount  = params.table.roundContributors[contributorIndex].amount;
  } else {
    params.table.roundContributors.push({
      playerId  : params.data.playerId,
      // amount    : parseInt(params.data.amount),
      amount    : fixedDecimal(params.data.amount, 2),
      // tempAmount: parseInt(params.data.amount)
      tempAmount: fixedDecimal(params.data.amount, 2)
    });
  }
  serverLog(stateOfX.serverLogType.info, 'RoundContri: Round contributors - ' + JSON.stringify(params.table.roundContributors));
  cb(null, params);
};

// update pot split on table IF round is over
var addAmountToPot = function(params, cb) {
serverLog(stateOfX.serverLogType.info, 'in moveRemote function addAmountToPot');
roundOver.checkRoundOver(params, function(roundOverResponse){
  // serverLog(stateOfX.serverLogType.info, 'roundOverResponse --------> ' + JSON.stringify(roundOverResponse));
  if(roundOverResponse.success && roundOverResponse.roundIsOver) {
    // serverLog(stateOfX.serverLogType.info, '---------POT BEFORE SPLIT--------------')
    // serverLog(stateOfX.serverLogType.info, JSON.stringify(params.table.pot))
    potsplit.processSplit(params, function (processSplitResponse) {
      serverLog(stateOfX.serverLogType.info, 'moveRemote ==> processSplitResponse - ' + _.keys(processSplitResponse.params));
      if(processSplitResponse.success) {
        params = processSplitResponse.params;
        serverLog(stateOfX.serverLogType.info, 'moveRemote ==> ==== PARAM DATA =====');
        serverLog(stateOfX.serverLogType.info, JSON.stringify(params.data));
        cb(null, params);
      } else {
        cb(processSplitResponse);
      }
    });

  } else {
    cb(null, params);
  }
});
};

// Set current raise and raise difference
// check for under raise condition
var checkUnderRaise = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "Table Min Raise: " + params.table.minRaiseAmount);
  serverLog(stateOfX.serverLogType.info, "Previous Raise difference: " + params.table.raiseDifference);
  serverLog(stateOfX.serverLogType.info, "Previous RAISE amount: " + params.table.lastRaiseAmount);
  serverLog(stateOfX.serverLogType.info, "Current " + params.data.action + " amount: " + params.data.amount);
  serverLog(stateOfX.serverLogType.info, "Expected Raise difference: " + (fixedDecimal(params.data.amount) - params.table.lastRaiseAmount));

  // Check if under raise occur
  if(params.data.action === stateOfX.move.allin) {
    var expectedRaiseDiff = fixedDecimal(params.data.amount, 2) - fixedDecimal(params.table.lastRaiseAmount, 2);
    var allinAmountLessThanMinRaise = fixedDecimal(params.data.amount, 2) < (params.table.minRaiseAmount - (params.table.players[params.data.index].totalRoundBet||0));
    serverLog(stateOfX.serverLogType.info, "Expected Raise difference: " + expectedRaiseDiff);


    if(!params.table.isBettingRoundLocked) {
      var IwasLastToAct = true;
      for (var i = 0; i < params.table.players.length; i++) {
        var player = params.table.players[i];
        serverLog(stateOfX.serverLogType.info, "other player "+ i + " - "+ JSON.stringify(player));
        if (player.playerId != params.data.playerId && params.table.onStartPlayers.indexOf(params.table.players[i].playerId)>=0 && params.table.players[i].roundId == params.table.roundId) {
          // playing players except me!
          if (player.state === stateOfX.playerState.playing || player.state === stateOfX.playerState.disconnected) {
            if (player.active) {
              if (!player.isPlayed) {
                IwasLastToAct = false;
                serverLog(stateOfX.serverLogType.info, "Current player was not last to act. 1");
                break;
              } else {
                if (params.data.roundLastMaxBet != player.totalRoundBet) {
                  if (player.lastMove !== stateOfX.move.allin) {
                    IwasLastToAct = false;
                    serverLog(stateOfX.serverLogType.info, "Current player was not last to act. 2");
                    break;
                  }
                }
              }
            }
          }
        }
      }
      // if(IwasLastToAct && expectedRaiseDiff < parseInt(params.table.raiseDifference/2)) {
      if(IwasLastToAct && allinAmountLessThanMinRaise) {
        serverLog(stateOfX.serverLogType.info, "Raise difference is less than half of previous raise, under raise applicable!");
        params.table.isBettingRoundLocked = true;
      } else {
        serverLog(stateOfX.serverLogType.info, "The raise difference is greater than half of previous raise diff, under raise is not applicable.");
      }
    } else {
      serverLog(stateOfX.serverLogType.info, "The betting round has been already locked!");
    }
  }

  // Set raise values
  if(params.data.action === stateOfX.move.raise || params.data.action === stateOfX.move.bet || params.data.action === stateOfX.move.allin) {
    serverLog(stateOfX.serverLogType.info, "Old values - " +params.data.amount+ ","+params.table.lastRaiseAmount+","+params.table.raiseDifference+","+params.table.considerRaiseToMax);
    if(fixedDecimal((fixedDecimal(params.data.originAmount, 2) - params.table.lastRaiseAmount), 2) >= fixedDecimal(params.table.raiseDifference, 2) && fixedDecimal(params.data.originAmount, 2) >= fixedDecimal(params.table.lastRaiseAmount)) {
      serverLog(stateOfX.serverLogType.info, "Updating raise difference and last raise on table value!"+ params.table.players[params.data.index].totalRoundBet);
      params.table.raiseDifference    = fixedDecimal((fixedDecimal(params.data.originAmount, 2) - params.table.lastRaiseAmount), 2);
      params.table.considerRaiseToMax = fixedDecimal(params.table.raiseDifference, 2);
      params.table.lastRaiseAmount    = fixedDecimal(params.data.originAmount, 2);
      params.table.raiseBy            = params.data.playerId;
      serverLog(stateOfX.serverLogType.info, "New values - " +params.data.amount+ ","+params.table.lastRaiseAmount+","+params.table.raiseDifference+","+params.table.considerRaiseToMax);
    } else {
      serverLog(stateOfX.serverLogType.info, "Not updating raise difference and last raise on table value!");
    }
    serverLog(stateOfX.serverLogType.info, "Updated Raise difference: " + params.table.raiseDifference);
    serverLog(stateOfX.serverLogType.info, "Updated raise amount: " + params.table.lastRaiseAmount);
  } else{
    serverLog(stateOfX.serverLogType.info, "Not updating raise difference and last raise on table bacause of " + params.data.action + " move!");
  }

  cb(null, params);
};

// Update table elements for this action
// > roundBets, roundMaxBet and pot
// and contributors
var updateTable = function(params, cb) {
serverLog(stateOfX.serverLogType.info, 'In moveRemote function updateTable');
isGameProgress(params, function (isGameProgressResponse){
  if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
    async.waterfall([
      async.apply(setRoundBets, params),
      setAllInOccured,
      setTotalContributors,
      setRoundContributors,
      addAmountToPot,
      checkUnderRaise
    ], function(err, response){
      if(err && !response) {
        cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.ASYNCWATERFALL_ISGAMEPROGRESS_UPDATETABLE_MOVEREMOTE, isRetry : false, isDisplay : true});
        //cb({success: false, channelId: params.channelId, info: "Updating table for this move failed!"})
      } else {
        cb(null, params);
      }
    });
  } else {
    cb(isGameProgressResponse);
  }
});
};

// Check If game is over due to this move
// > Handle all game over cases here
// IF no player had move
var validateGameOver = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In moveRemote function validateGameOver');
  // Game should over if no player left with move
  if(tableManager.isPlayerWithMove(params) === false) {
    serverLog(stateOfX.serverLogType.info, 'There are no players with move left into the game, Game Over!');
    params.table.state = stateOfX.gameState.gameOver;
  }
  cb(null, params);
};

// process round over
// internally it will check if round is over or not
var isRoundOver = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In moveRemote function isRoundOver');
  // serverLog(stateOfX.serverLogType.info, 'Checking round over condition.')
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      roundOver.processRoundOver(params, function(processRoundOverResponse){
        if(processRoundOverResponse.success && !processRoundOverResponse.isGameOver) {
          cb(null, processRoundOverResponse.params);
        } else {
          cb(processRoundOverResponse);
        }
      });
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// set next player who has move
// according to cases - round got over or not
 var setNextPlayer = function(params, cb) {
 serverLog(stateOfX.serverLogType.info, 'In moveRemote function setNextPlayer');
 isGameProgress(params, function (isGameProgressResponse){
   if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
     serverLog(stateOfX.serverLogType.info, 'Round over while setting next player move - ' + params.data.roundOver);
     if(params.data.roundOver) {
       serverLog(stateOfX.serverLogType.info, 'First move index while setting first turn after round end: ' + params.table.firstActiveIndex);
       params.table.currentMoveIndex = params.table.firstActiveIndex;
       serverLog(stateOfX.serverLogType.info, 'Updated current move index on-round-over - ' + params.table.currentMoveIndex);
     } else {
       serverLog(stateOfX.serverLogType.info, 'Current player details while setting next player move - ' + JSON.stringify(params.table.players[params.data.index])) ;
       params.table.currentMoveIndex = params.table.players[params.data.index].nextActiveIndex;
       serverLog(stateOfX.serverLogType.info, 'Updated current move index on no-round-over - ' + params.table.currentMoveIndex);
     }
     serverLog(stateOfX.serverLogType.info, 'Updated current move index - ' + params.table.currentMoveIndex);
     if(params.table.currentMoveIndex === -1) {
       cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.ISGAMEPROGRESS_SETNEXTPLAYER_MOVEREMOTE, isRetry : false, isDisplay : true});
       serverLog(stateOfX.serverLogType.info, 'An error occured while performing move players - ' + JSON.stringify(params.table.players));
       return false;
     } else {
       params.table.maxRaiseAmount = tableManager.maxRaise(params.table);
       cb(null, params);
     }
   } else {
     cb(isGameProgressResponse);
   }
 });
};

// ### Update first player index if
// > First active player left the game
var setfirstActiveIndex = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In moveRemote function setfirstActiveIndex');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if((params.data.action === stateOfX.move.fold || params.data.action === stateOfX.move.allin) && params.data.index === params.table.firstActiveIndex) {
        serverLog(stateOfX.serverLogType.info, 'Resetting first move index from - ' + params.table.firstActiveIndex);
        params.table.firstActiveIndex = params.table.players[params.data.index].nextActiveIndex;
        serverLog(stateOfX.serverLogType.info, 'Resetting first move index to - ' + params.table.firstActiveIndex);
        cb(null, params);
      } else {
        serverLog(stateOfX.serverLogType.info, 'Not resetting first move index from - ' + params.table.firstActiveIndex);
        cb(null, params);
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// set moves for next player
var getMoves = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In moveRemote function getMoves');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      setMove.getMove(params, function (getMoveResponse){
        if(getMoveResponse.success) {
          cb(null, getMoveResponse.params);
        } else {
          cb(getMoveResponse);
        }
      });
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// Adjust active player indexes among each other
// > Set preActiveIndex and nextActiveIndex values for each player
// > Used for turn transfer importantly
var adjustActiveIndexes = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In moveRemote function adjustActiveIndexes');
  if(params.data.action === stateOfX.move.fold || params.data.action === stateOfX.move.allin) {
    adjustIndex.perform(params, function(performResponse) {
      serverLog(stateOfX.serverLogType.info, 'Updated active indexes response: ' + JSON.stringify(performResponse));
      cb(null, performResponse.params);
    });
  } else {
    cb(null, params);
  }
};

// ### Decide players prechecks
var decidePlayerPrechecks = function (params, cb) {
setMove.assignPrechecks(params, function(assignPrechecksResponse) {
  if(assignPrechecksResponse.success) {
    params = assignPrechecksResponse.params;
    cb(null, params);
  } else {
    cb(assignPrechecksResponse);
  }
});
};


// ### Create response for this move
// > Considering turn, round over and Game over can happen at once
var createTurnResponse = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In moveRemote function createTurnResponse');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {

      // Set current time for player turn starts at
      params.table.turnTimeStartAt = Number(new Date());

      params.data.success           = true;
      params.data.isGameOver        = false;
      params.data.winners           = isGameProgressResponse.winners;
      params.data.rakeDeducted      = isGameProgressResponse.rakeDeducted;
      params.data.cardsToShow       = isGameProgressResponse.cardsToShow;

      responseHandler.setActionKeys(params, function(setActionKeysResponse){
        cb(null, setActionKeysResponse);
      });

    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Set min and max raise amount for next player
// > Who is going to get move after this action
// Rule for min raise = Current Bet + Next Player Call Amount - Previous Bet Amount on table
var setMinMaxRaiseAmount = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In moveRemote function setMinMaxRaiseAmount');
  // if(params.table.currentMoveIndex === -1) {
  //   cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""),info: popupTextManager.NOCURRENTPLAYERONMAXRAISE});
  //   return false;
  // }
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      params.table.maxRaiseAmount = tableManager.maxRaise(params.table);
      serverLog(stateOfX.serverLogType.info, 'Updated max raise value - ' + params.table.maxRaiseAmount);
      params.table.minRaiseAmount = tableManager.minRaise(params);
      serverLog(stateOfX.serverLogType.info, 'Updated min raise value - ' + params.table.minRaiseAmount);
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Handle all cases required to handle a player move
// > Params: {self, channelId, table, data {channelId, playerId, amount, action, isRequested}, table}

moveRemote.takeAction = function(params, cb) {
serverLog(stateOfX.serverLogType.info, 'In moveRemote function moveRemote');
params = _.omit(params, 'self');
serverLog(stateOfX.serverLogType.info, 'Action perform params - ' + JSON.stringify(params.table.players));

async.waterfall([

  async.apply(initializeParams, params),
  validateTableAttributeToPerformMove,
  isMoveExists,
  validatePlayer,
  validateMoveAllowed,
  setBetAmount,
  validateBetAmount,
  setAllInMove,
  updatePlayer,
  updateTable,
  summaryOnFold,
  validateGameOver,
  isRoundOver,
  setfirstActiveIndex,
  setNextPlayer,
  setMinMaxRaiseAmount,
  getMoves,
  decidePlayerPrechecks,
  adjustActiveIndexes,
  createTurnResponse

], function (err, response){
  if(err) {
    if(!!err.data && err.data.success) {
      cb({success: true, table: params.table, data: params.data});
    } else {
      // serverLog(stateOfX.serverLogType.info, 'moveRemote - This should not be a success response - ' + JSON.stringify(err));
      activity.makeMove(params, stateOfX.profile.category.game, stateOfX.game.subCategory.move, response,stateOfX.logType.error);
      activity.makeMove(params, stateOfX.profile.category.gamePlay, stateOfX.gamePlay.subCategory.move, response,stateOfX.logType.error);
      cb(err);
    }
  } else {
    activity.makeMove(params, stateOfX.profile.category.game, stateOfX.game.subCategory.move, response,stateOfX.logType.success);
    activity.makeMove(params, stateOfX.profile.category.gamePlay, stateOfX.gamePlay.subCategory.move, response,stateOfX.logType.success);
    cb({success: true, table: params.table, data: params.data});
  }
});
};

module.exports = moveRemote;
