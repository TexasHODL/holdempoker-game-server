/*jshint node: true */
"use strict";

/**
 * Created by Amrendra on 30/09/2016.
**/
var async           = require("async"),
    _ld             = require("lodash"),
    _               = require('underscore'),
    stateOfX        = require("../../../../shared/stateOfX"),
    keyValidator    = require("../../../../shared/keysDictionary"),
    imdb            = require("../../../../shared/model/inMemoryDbQuery.js"),
    db              = require("../../../../shared/model/dbQuery.js"),
    mongodb         = require('../../../../shared/mongodbConnection'),
    zmqPublish      = require("../../../../shared/infoPublisher"),
    roundOver       = require('./utils/roundOver'),
    setMove         = require('./setMove'),
    potsplit        = require('./potsplit'),
    adjustIndex     = require('./adjustActiveIndex'),
    handleGameOver  = require('./handleGameOver'),
    tableManager    = require("./tableManager"),
    popupTextManager  = require("../../../../shared/popupTextManager"),
    responseHandler = require("./responseHandler");

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'tournamentLeave';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

var isGameProgress = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in tournamentLeave function isGameProgress');
  keyValidator.validateKeySets("Request", params.serverType, "isGameProgress", params, function(validated){
    if(validated.success) {
      if(params.table.state === stateOfX.gameState.running) {
        cb({success: true, isGameOver: false});
      } else {
        handleGameOver.processGameOver(params, function(gameOverResponse){
          serverLog(stateOfX.serverLogType.info, 'Game over response in tournamentLeave - ' + JSON.stringify(gameOverResponse));
          if(gameOverResponse.success) {
            params = gameOverResponse.params;

            serverLog(stateOfX.serverLogType.info,'isCurrentPlayer while respone after GAME OVER - ' + params.data.isCurrentPlayer);
            params = gameOverResponse.params;
            params.data.success           = true;
            params.data.roundOver         = true;
            params.data.isGameOver        = true;
            params.data.currentBoardCard  = params.data.remainingBoardCards;
            params.data.winners           = gameOverResponse.winners;
            params.data.rakeDeducted      = gameOverResponse.rakeDeducted;
            params.data.cardsToShow       = gameOverResponse.cardsToShow;
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

var validateGameOver = function (params, cb) {
  // Check if Game should over after this leave
  // Game will over if there is only one active player left or
  // ALLIN player also consider as inactive then we need to check all players made their move
  // We are not considering here if the player with move left or any other player left
  // As Game can over either conditions
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {

      serverLog(stateOfX.serverLogType.info,'-------- Validating Game Over -------');
      serverLog(stateOfX.serverLogType.info,'Player who has move leaving the table? - ' + params.data.isCurrentPlayer);

      if(params.data.index >= 0 ) {
        if(params.data.state !== stateOfX.playerState.waiting && params.data.state !== stateOfX.playerState.outOfMoney && params.data.state !== stateOfX.playerState.onBreak) {
          if(tableManager.isPlayerWithMove(params) === false) {
            serverLog(stateOfX.serverLogType.info,'There are no players with move left into the game, Game Over!');
            params.table.state = stateOfX.gameState.gameOver;
          } else {
            serverLog(stateOfX.serverLogType.info,'There are players with move left in the game.');
          }
        } else {
          serverLog(stateOfX.serverLogType.info,'NOT CHECKING Game Over as playing with - ' + params.table.players[params.data.index].state + ' left the game!');
        }
      } else {
        serverLog(stateOfX.serverLogType.info,'NOT CHECKING Game Over as player not taken a seat left the game!');
      }
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

var intializeParams = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in tournamentLeave function setLeaveParams');
  params.data        = _.omit(params.data, '__route__');
  params.data.action = params.data.isStandup ? stateOfX.move.standup.toUpperCase() : stateOfX.move.leave.toUpperCase();
  params.data.index  = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
  params.data.chips  = 0;
  if(params.data.index >= 0) {
    // If player has taken a seat on table
    params.data.state           = params.table.players[params.data.index].state;
    params.data.chips           = params.table.players[params.data.index].chips;
    params.data.nextActiveIndex = params.table.players[params.data.index].nextActiveIndex;
    serverLog(stateOfX.serverLogType.info, 'Player details who is going to leave - ' + JSON.stringify(params.table.players[params.data.index]));
  }
  params.data.isCurrentPlayer = false;
  params.data.roundOver       = false;
  params.data.isGameOver      = (params.table.state === stateOfX.gameState.gameOver);
  params.data.amount          = 0;
  params.data.pot             = _.pluck(params.table.pot, 'amount');
  serverLog(stateOfX.serverLogType.info,'Player at index - ' + params.data.index + ' is going to ' + params.data.action + ' !');
  cb(null, params);
};

// Validate if this standup or leave is allowed for this player
// > Spectator player cannot opt to standup

var validateAction = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in tournamentLeave function validateAction');
  if(params.data.index < 0 && params.data.action === stateOfX.move.standup) {
    //cb({success: false, channelId: params.channelId, info: "You are not allowed to " + params.data.action + ", please choose Leave."});
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.VALIDATEACTIONFAIL_TOURNAMENTLEAVE});
  } else {
    cb(null, params);
  }
};


var updatePlayer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in tournamentLeave function updatePlayer');
  if(params.data.index >= 0) {
    params.table.players[params.data.index].tournamentData.isTournamentSitout = true;
    params.table.players[params.data.index].lastMove                          = stateOfX.move.fold;
    params.table.players[params.data.index].active                            = false;
    cb(null, params);
  } else {
    cb(null, params);
  }
};

var isCurrentPlayer = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in tournamentLeave function isCurrentPlayer');
  if(params.data.index >= 0) {
    serverLog(stateOfX.serverLogType.info,'Resetting isCurrentPlayer');
    params.data.isCurrentPlayer = params.data.index === params.table.currentMoveIndex;
    if(params.data.isCurrentPlayer) {
      params.table.currentMoveIndex = params.table.players[params.data.index].nextActiveIndex;
      serverLog(stateOfX.serverLogType.info,'This is current player with move, setting next player after this, new current player index - ' + params.table.currentMoveIndex);
    }
    serverLog(stateOfX.serverLogType.info,'Updated isCurrentPlayer in tournament - ' + params.data.isCurrentPlayer);
  }
  cb(null, params);
};

var adjustActiveIndexes = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in tournamentLeave function adjustActiveIndexes');
  adjustIndex.perform(params, function(performResponse) {
    cb(null, performResponse.params);
  });
};

// ### Update current player and first active player indexes

var updateConfigIndexes = function (params, cb) {
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      // Update currentMoveIndex if required
      // In case of player leave in between from array
      serverLog(stateOfX.serverLogType.info,'-------- Updating config indexes -------');
      // Do not add PLAYING state condition as any player on the table leave will
      // update the indexes of config players
      if(params.data.index >= 0) {
        serverLog(stateOfX.serverLogType.info,'Player has taken a seat on table');
        // serverLog(stateOfX.serverLogType.info,'table while removing player - ' + JSON.stringify(_.omit(params.table, 'deck')))
        serverLog(stateOfX.serverLogType.info,'players while leave - ' + JSON.stringify(params.table.players));
        serverLog(stateOfX.serverLogType.info,'currentMoveIndex - ' + params.table.currentMoveIndex);
        serverLog(stateOfX.serverLogType.info,'firstActiveIndex - ' +  params.table.firstActiveIndex);
        serverLog(stateOfX.serverLogType.info,'Index of player to leave - ' + params.data.index);
        // serverLog(stateOfX.serverLogType.info,'Active players - ' + JSON.stringify(activePlayers));

        // If player left before config index then reduce config indexes
        // if(params.data.index < params.table.currentMoveIndex) {
        //   serverLog(stateOfX.serverLogType.info,'Player left before config indexes SETTING current player');
        //   if(params.table.currentMoveIndex - 1 >= 0) {
        //     params.table.currentMoveIndex = params.table.currentMoveIndex - 1;
        //   }
        //   serverLog(stateOfX.serverLogType.info,'New currentMoveIndex should be - ' + params.table.currentMoveIndex)
        // }

        // If player left before config index then reduce config indexes
        // If player left after dealer index
        if(params.table.dealerIndex > params.data.index && params.data.index < params.table.firstActiveIndex) {
          serverLog(stateOfX.serverLogType.info,'Player left before config indexes SETTING first active player index');
          if(params.table.firstActiveIndex - 1 >= 0) {
            params.table.firstActiveIndex = params.table.firstActiveIndex - 1;
          }
          serverLog(stateOfX.serverLogType.info,'New firstActiveIndex should be - ' + params.table.firstActiveIndex);
        } else if(params.data.index == params.table.firstActiveIndex) {
          serverLog(stateOfX.serverLogType.info,'Player who will have first move after PREFLOP is leaving, reset first move after Dealer!');
          params.table.firstActiveIndex = params.table.players[params.table.dealerIndex].nextActiveIndex;
           // params.data.nextActiveIndex
          serverLog(stateOfX.serverLogType.info,'New firstActiveIndex should be - ' + params.table.firstActiveIndex);
        }
      } else {
        serverLog(stateOfX.serverLogType.info,'Player hasnt taken a seat or not PLAYING in the table while ' + params.data.action + ' !');
      }

      //

      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

var isRoundOver = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in tournamentLeave function isRoundOver');
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

var setNextPlayer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in tournamentLeave function setNextPlayer');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(params.data.isCurrentPlayer) {
        if(params.data.roundOver) {
          serverLog(stateOfX.serverLogType.info,'Round is over after this leave, setting first player index as next player with turn.');
          params.table.currentMoveIndex = params.table.firstActiveIndex;
          serverLog(stateOfX.serverLogType.info,'Next player move set to first active index - ' + params.table.currentMoveIndex);
          cb(null, params);
        } else {
          serverLog(stateOfX.serverLogType.info,'Round doesnt over after this leave, setting next active index as next player with turn.');
          // params.table.currentMoveIndex = params.table.players[params.table.currentMoveIndex].nextActiveIndex;
          serverLog(stateOfX.serverLogType.info,'Next player move will not resetting here, might be already set in previous functions');
          cb(null, params);
        }
      } else {
        serverLog(stateOfX.serverLogType.info, 'Player was not the player with turn, so skipping turn transfer.');
        cb(null, params);
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Set maximum raise for next player
var setMaxRaise = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In tournamentLeave function setMaxRaise');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      params.table.maxRaiseAmount = tableManager.maxRaise(params.table);
      serverLog(stateOfX.serverLogType.info, 'tournamentLeave Updated max raise - ' + params.table.maxRaiseAmount);
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

var getMoves = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in tournamentLeave function getMoves');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(params.data.isCurrentPlayer) {
        setMove.getMove(params, function(getMoveResponse){
          if(getMoveResponse.success) {
            cb(null, getMoveResponse.params);
          } else {
            cb(getMoveResponse);
          }
        });
      } else {
        cb(null, params);
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

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

var createResponse = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in tournamentLeave function generateResponse');
  // params.data.action = stateOfX.move.fold;
  responseHandler.setActionKeys(params, function(setActionKeysResponse){
    serverLog(stateOfX.serverLogType.info, 'Leave response generated in tournament - ' + JSON.stringify(setActionKeysResponse));
    cb(null, setActionKeysResponse);
  });
};

module.exports.processLeave = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Tournament leave starts');
  async.waterfall([
    async.apply(intializeParams, params),
    validateAction,
    updatePlayer,
    isCurrentPlayer,
    adjustActiveIndexes,
    updateConfigIndexes,
    validateGameOver,
    isRoundOver,
    setNextPlayer,
    setMaxRaise,
    getMoves,
    adjustActiveIndexes,
    decidePlayerPrechecks,
    createResponse
  ], function(err, response){
    serverLog(stateOfX.serverLogType.info, 'err, response in tournamentLeave.');
    serverLog(stateOfX.serverLogType.error, 'err - ' + JSON.stringify(err));
    // serverLog(stateOfX.serverLogType.info, 'Response-data-response in tournament leave - ' + JSON.stringify(response.data.response));
    if(err) {
      if(!!err.data && err.data.success) {
        cb({success: true, table: err.table, data: err.data});
      } else {
        serverLog(stateOfX.serverLogType.error, '1. This should not be success response for LEAVE - ' + JSON.stringify(err));
        cb(err);
      }
    } else {
      cb({success: true, table: response.table, data: response.data});
    }
  });
};
