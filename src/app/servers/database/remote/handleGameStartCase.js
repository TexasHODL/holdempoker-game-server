/*jshint node: true */
"use strict";

/**
 * Created by Amrendra on 21/06/2016.
**/
var async          = require("async"),
    _ld            = require("lodash"),
    _              = require('underscore'),
    setMove        = require('./setMove'),
    potsplit       = require('./potsplit'),
    adjustIndex    = require('./adjustActiveIndex'),
    handleGameOver = require('./handleGameOver'),
    stateOfX       = require("../../../../shared/stateOfX"),
    keyValidator   = require("../../../../shared/keysDictionary"),
    popupTextManager= require("../../../../shared/popupTextManager").falseMessages,
    popupTextManagerFromdb = require("../../../../shared/popupTextManager").dbQyeryInfo,
    imdb           = require("../../../../shared/model/inMemoryDbQuery.js"),
    mongodb        = require('../../../../shared/mongodbConnection'),
    zmqPublish     = require("../../../../shared/infoPublisher"),
    tableManager   = require("./tableManager");

// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'handleGameStartCase';
  logObject.serverName   = stateOfX.serverType.database;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  // zmqPublish.sendLogMessage(logObject);
  console.log(JSON.stringify(logObject));
}

// if game gets over in blind deduction
// then this file handles it
// No betting round happens in such game
var handleGameStartCase = function(app) {
  // this.app            = app;
  // this.channelService = app.get('channelService');
};

// to check game state through out the process
// if game over? process game over
// create game over response
var isGameProgress = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Game state while handling game start cases ' + params.table.state);
  if(params.table.state === stateOfX.gameState.running) {
    cb({success: true, isGameOver: false});
  } else {
    handleGameOver.processGameOver(params, function (gameOverResponse){
      serverLog(stateOfX.serverLogType.info, 'gameOverResponse while Game start case handling');
      serverLog(stateOfX.serverLogType.info, JSON.stringify(gameOverResponse));
      if(gameOverResponse.success) {
        params = gameOverResponse.params;

        // Set response keys
        params.data.overResponse.isGameOver   = true;
        params.data.overResponse.isRoundOver  = true;

        // Resetting turn broadcast for Game Over
        for(var i=0; i<params.data.overResponse.turns.length; i++) {
          params.data.overResponse.turns[i].isRoundOver      = true;
          params.data.overResponse.turns[i].roundName        = stateOfX.round.showdown;
          params.data.overResponse.turns[i].currentMoveIndex = -1;
          params.data.overResponse.turns[i].pot              = _.pluck(params.table.pot, 'amount');
        }

        params.data.overResponse.round = {
          success   : true,
          channelId : params.data.channelId,
          roundName : stateOfX.round.showdown,
          boardCard : params.data.remainingBoardCards
        };

        params.data.overResponse.over = {
          success     : true,
          channelId   : params.data.channelId,
          endingType  : stateOfX.endingType.gameComplete,
          cardsToShow : gameOverResponse.cardsToShow,
          winners     : gameOverResponse.winners
        };

        cb({
          success     : true,
          isGameOver  : true,
          isRoundOver : true,
          table       : gameOverResponse.params.table,
          data        : params.data,
          response    : params.data.overResponse
        });
      } else {
        cb(gameOverResponse);
      }
    });
  }
};

// Get moves for current player
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

// ### Add additional params in existing one for calculation
var initializeParams = function(params, cb) {
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {

      params.data                           = _.omit(params.data, '__route__');
      params.data.playingPlayers            = _.where(params.table.players, {state: stateOfX.playerState.playing});
      params.data.overResponse              = {};
      params.data.overResponse.isGameOver   = false;
      params.data.overResponse.isRoundOver  = false;
      params.data.overResponse.turns        = [];
      params.data.isAllInOccured            = false;

      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// check if all in occured on table for any player
var isAllInOccured = function(params, cb) {
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {

      if(_.where(params.table.players, {state: stateOfX.playerState.playing, chips: 0}).length > 0) {
        // Added specially for tournament as player were not going into OUTOFMONEY state
        // and game used to get started with OUTOFMONEY player
        // _.where(params.table.players, {state: stateOfX.playerState.playing, chips: 0})[0].state = stateOfX.playerState.outOfMoney;
        params.data.isAllInOccured    = true;
        params.table.isAllInOcccured  = true;
        serverLog(stateOfX.serverLogType.info, 'ALLIN occured on game start!');
        cb(null, params);
      } else {
        cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.ISGAMEPROGRESS_ISALLINOCCURED_HANDLEGAMESTARTCASE, isRetry : false, isDisplay : true});
      }

    } else {
      cb(isGameProgressResponse);
    }
  });
};

// set all in players states and 
// turns object for broadcast
// accordingly adjust first turn player
var setAllInPlayerAttributes = function(params, cb) {
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      serverLog(stateOfX.serverLogType.info, 'Tables while creating turn response on Game start allin case - ' + JSON.stringify(params.table));
      serverLog(stateOfX.serverLogType.info, 'Players setAllInPlayerAttributes - ' + JSON.stringify(params.table.players));

      var allInPlayers = _.where(params.table.players, {state: stateOfX.playerState.playing, chips: 0});
      serverLog(stateOfX.serverLogType.info, 'All in players - ' + JSON.stringify(_.pluck(allInPlayers, 'playerName')));
      var allInPlayerIndex = [];
      for (var i = 0; i < allInPlayers.length; i++) {
        serverLog(stateOfX.serverLogType.info, 'Setting ALLIN player details');

        var indexOfPlayer = _ld.findIndex(params.table.players, {playerId: allInPlayers[i].playerId});
        serverLog(stateOfX.serverLogType.info, 'This allin player index - ' + indexOfPlayer);

        allInPlayerIndex.push(indexOfPlayer);

        allInPlayers[i].active    = false;
        allInPlayers[i].lastMove  = stateOfX.move.allin;
        allInPlayers[i].isPlayed  = true;

        serverLog(stateOfX.serverLogType.info, 'After updating ALLIN players  - ' + JSON.stringify(allInPlayers[i]));

        // Reset first player turn
        // If player next to dealer went to ALLIN
        if(indexOfPlayer === params.table.firstActiveIndex) {
          serverLog(stateOfX.serverLogType.info, 'This is the first active player to dealer went ALLIN.');
          params.table.firstActiveIndex = params.table.players[indexOfPlayer].nextActiveIndex;
        }

        // ISSUE: when player sit with post blind and first to act and goes all in with post blind then moves remains with that player
        // Fixed: if current move is with all-in player then move going to be at the next player change currentmoveindex value
        // Also update minRaise and max Raise amount
        if (indexOfPlayer === params.table.currentMoveIndex){
          params.table.currentMoveIndex = params.table.players[indexOfPlayer].nextActiveIndex;
          // params.table.currentMoveIndex = params.table.firstActiveIndex;
          params.table.maxRaiseAmount = tableManager.maxRaise(params.table);
          serverLog(stateOfX.serverLogType.info, 'Updated max raise value - ' + params.table.maxRaiseAmount);
          params.table.minRaiseAmount = tableManager.minRaise(params);
          serverLog(stateOfX.serverLogType.info, 'Updated min raise value - ' + params.table.minRaiseAmount);
        }

        params.data.overResponse.turns.push({
          success           : true,
          channelId         : params.data.channelId,
          playerId          : allInPlayers[i].playerId,
          playerName        : allInPlayers[i].playerName,
          amount            : params.table.roundBets[_ld.findIndex(params.table.players, {playerId: allInPlayers[i].playerId})],
          action            : stateOfX.move.allin,
          chips             : allInPlayers[i].chips,
          currentMoveIndex  : params.table.players[params.table.currentMoveIndex].seatIndex,
          moves             : params.table.players[params.table.currentMoveIndex].moves,
          totalRoundBet     : params.table.players[indexOfPlayer].totalRoundBet,
          totalGameBet      : params.table.players[indexOfPlayer].totalGameBet,
          roundMaxBet       : params.table.roundMaxBet,
          roundName         : params.table.roundName,
          pot               : _.pluck(params.table.pot, 'amount'),
          minRaiseAmount    : params.table.minRaiseAmount,
          // minRaiseAmount    : tableManager.minRaise(params.table),
          maxRaiseAmount    : params.table.maxRaiseAmount,
          // maxRaiseAmount    : tableManager.maxRaise(params.table),
          totalPot          : tableManager.getTotalPot(params.table.pot) + tableManager.getTotalBet(params.table.roundBets)
        });
      }

      // ISSUE: when all the blind player goes Allin at game start while deduct blinds then,
      // after a single completion of round the turn goes to the player which already done all In while deduct blinds.
      // This is due to the improper setting of the first active index which remained at the player which has done allin.
      // Case: Described in testing sheet
      // How Resolved: By checking the first active index is properly assigned and not with the allin player.
      // Fix By: Digvijay Singh (26 Dec 2019)
      for(let i = 0; i< allInPlayerIndex.length; i++){
        console.log("inside Digvijay fixe previous FAI "+ params.table.firstActiveIndex + " allINPlayerArray "+ allInPlayerIndex);
        console.log("value of condition " + allInPlayerIndex.indexOf[params.table.firstActiveIndex]);
        if (allInPlayerIndex.indexOf(params.table.firstActiveIndex) > -1){
          console.log("gone in if condition");
          params.table.firstActiveIndex = params.table.players[params.table.firstActiveIndex].nextActiveIndex;
        }
        console.log("inside Digvijay fixe after "+ params.table.firstActiveIndex);
      }
      
      console.log("inside Digvijay fixe overall "+ params.table.firstActiveIndex);
      
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// again set available moves options in all turns broadcast objects
var resetMoveInTurnResponse = function(params, cb) {
  for (var i = 0; i < params.data.overResponse.turns.length; i++) {
    serverLog(stateOfX.serverLogType.info, 'Resetting move in turn response');
    params.data.overResponse.turns[i].moves = params.table.players[params.table.currentMoveIndex].moves;
    serverLog(stateOfX.serverLogType.info, params.data.overResponse.turns[i].moves);
  }
  cb(null, params);
};

// check for game over by
// is there any player with move?
var checkIfOnStartGameOver = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in handleGameStartCase - checkIfOnStartGameOver');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(tableManager.isPlayerWithMove(params) === false) {
        serverLog(stateOfX.serverLogType.info, 'There are no players with move left into the game, Game Over!');
        params.table.state = stateOfX.gameState.gameOver;
      }
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// check for game over by
// small blind player all in + 2 playing players
var smallBlindAllInGameOver = function(params, cb) {
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(params.data.playingPlayers.length === 2 && params.table.players[params.table.smallBlindIndex].lastMove === stateOfX.move.allin) {
        serverLog(stateOfX.serverLogType.info, '2 player Case: Small Blind went ALLIN, checking Game Over condition!');
        params.table.state = stateOfX.gameState.gameOver;
        cb(null, params);
      } else {
        cb(null, params);
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// check for game over by
// big blind player all in + 2 playing players + small blind posted more than big blind posted
var bigBlindAllInGameOver = function(params, cb) {
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(params.data.playingPlayers.length === 2 && params.table.players[params.table.bigBlindIndex].lastMove === stateOfX.move.allin) {
        serverLog(stateOfX.serverLogType.info, '2 player Case: Big Blind went ALLIN, checking Game Over condition!');
        serverLog(stateOfX.serverLogType.info, 'Big blind index - ' + params.table.bigBlindIndex);
        serverLog(stateOfX.serverLogType.info, 'Small blind index - ' + params.table.smallBlindIndex);
        serverLog(stateOfX.serverLogType.info, 'Round bets on table - ' + params.table.roundBets);
        if(params.table.roundBets[params.table.bigBlindIndex] <= params.table.roundBets[params.table.smallBlindIndex]) {
          serverLog(stateOfX.serverLogType.info, 'Small blind posted more than Big blind player so Game is over now.');
          params.table.state = stateOfX.gameState.gameOver;
        }
        cb(null, params);
      } else {
        cb(null, params);
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// again set round over info and name in turns broadcast
// IF game got over
var addRoundOverInTurn = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in handleGameStartCase - addRoundOverInTurn');
  if(params.table.state === stateOfX.gameState.gameOver) {
    serverLog(stateOfX.serverLogType.info, 'Adding round over additional key in turn broadcast');
    for (var i = 0; i < params.data.overResponse.turns.length; i++) {
      params.data.overResponse.turns[i].isRoundOver = true;
      params.data.overResponse.turns[i].roundName   = stateOfX.round.showdown;
    }
    cb(null, params);
  } else {
    cb(null, params);
  }
};

// initialize
// does nothing as yet
var setTableEntitiesOnStart = function(params, cb) {
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// create "game-start-game-over" response
var createGameStartCaseResponse = function(params, cb) {
  isGameProgress(params, function (isGameProgressResponse){
    serverLog(stateOfX.serverLogType.info, 'in createGameStartCaseResponse isGameProgressResponse');
    serverLog(stateOfX.serverLogType.info, JSON.stringify(isGameProgressResponse));
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      cb(null, {
        success : true,
        table   : params.table,
        data    : params.data,
        response: params.data.overResponse
      });
    } else {
      cb(isGameProgressResponse);
    }
  });
};


// ### Adjust active player indexes among each other
// > Set preActiveIndex and nextActiveIndex values for each player
// > Used for turn transfer importantly
var adjustActiveIndexes = function(params, cb) {
  adjustIndex.perform(params, function(performResponse) {
    serverLog(stateOfX.serverLogType.info, 'in handleGameStartCase performResponse');
    cb(null, performResponse.params);
  });
};

// ### Handle all cases required to handle an action
// > Params: {self, channelId, table, data {channelId, playerId, amount, action, isRequested}, table}
// if game gets over in blind deduction
// then this file handles it
// No betting round happens in such game
handleGameStartCase.processGameStartCases = function(params, cb) {
  // serverLog(stateOfX.serverLogType.info, ' request processGameStartCases - ' + JSON.stringify(params));
  console.trace("Digvijay in handle addition case");
  keyValidator.validateKeySets("Request", "database", "processGameStartCases", params, function (validated){
    params = _.omit(params, 'self');
    if(validated.success) {
      async.waterfall([

        async.apply(initializeParams, params),
        isAllInOccured,
        setAllInPlayerAttributes,
        getMoves,
        resetMoveInTurnResponse,
        checkIfOnStartGameOver,
        smallBlindAllInGameOver,
        bigBlindAllInGameOver,
        addRoundOverInTurn,
        setTableEntitiesOnStart,
        adjustActiveIndexes,
        createGameStartCaseResponse

      ], function (err, response){
        serverLog(stateOfX.serverLogType.info, 'err and response in processGameStartCases');
        serverLog(stateOfX.serverLogType.info, JSON.stringify(err));
        serverLog(stateOfX.serverLogType.info, JSON.stringify(response));
        if(err) {
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

module.exports = handleGameStartCase;
