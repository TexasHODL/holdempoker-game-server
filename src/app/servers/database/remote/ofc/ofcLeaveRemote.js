/*jshint node: true */
"use strict";

/**
 * Created by Amrendra on 04/07/2016.
**/
var async              = require("async"),
    _ld                = require("lodash"),
    _                  = require('underscore'),
    stateOfX           = require("../../../../../shared/stateOfX"),
    keyValidator       = require("../../../../../shared/keysDictionary"),
    imdb               = require("../../../../../shared/model/inMemoryDbQuery.js"),
    db                 = require("../../../../../shared/model/dbQuery.js"),
    mongodb            = require('../../../../../shared/mongodbConnection'),
    profileMgmt        = require("../../../../../shared/model/profileMgmt"),
    zmqPublish         = require("../../../../../shared/infoPublisher"),
    ofcAdjustIndex     = require('./ofcAdjustActiveIndex'),
    ofcHandleGameOver  = require('./ofcHandleGameOver'),
    ofcTableManager    = require("./ofcTableManager"),
    ofcResponseHandler = require("./ofcResponseHandler");


var ofcLeaveRemote = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject           = {};
  logObject.fileName      = 'ofcLeaveRemote';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}


// Validate if Game is running throughout calculation of player leave
// If Game is over then process game over and then
// Create response for Game over as well and return to relevant function

var isGameProgress = function(params, cb) {
  if(params.table.state === stateOfX.gameState.running) {
    cb({success: true, isGameOver: false, info: "Game state check in move, Game is still running."});
  } else {
    ofcHandleGameOver.processGameOver(params, function (gameOverResponse){
      serverLog(stateOfX.serverLogType.info, 'Game over response in ofcMoveRemote - ' + JSON.stringify(gameOverResponse));
      if(gameOverResponse.success) {
        params                   = gameOverResponse.params;
        params.data.success      = true;
        params.data.isGameOver   = true;
        params.data.winners      = gameOverResponse.params.data.winners;
        params.data.rakeDeducted = gameOverResponse.params.data.rakeDeducted;
        ofcResponseHandler.setActionKeys(params, function(setActionKeysResponse){
          cb(setActionKeysResponse);
        });
      } else {
        cb(gameOverResponse);
      }
    });
  }
};

// ### Add additional params in existing one for calculation

var initializeParams = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcLeaveRemote function initializeParams');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      params.data                   = _.omit(params.data, '__route__');
      params.data.action            = params.data.isStandup ? stateOfX.move.standup : stateOfX.move.leave;
      params.data.index             = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
      params.data.state             = null;
      if(params.data.index >= 0) {
        // If player has taken a seat on table
        params.data.state           = params.table.players[params.data.index].state;
        serverLog(stateOfX.serverLogType.info, 'Player details who is going to leave - ' + JSON.stringify(params.table.players[params.data.index]));
      }
      params.data.isCurrentPlayer   = false;
      params.data.roundOver         = false;
      params.data.isGameOver        = (params.table.state === stateOfX.gameState.gameOver);
      params.data.chips             = 0;
      params.data.amount            = 0;
      params.data.pot               = _.pluck(params.table.pot, 'amount');
      params.data.currentBoardCard  = [[], []];
      serverLog(stateOfX.serverLogType.info,'Player ' + params.data.playerName + ' at index - ' + params.data.index + ' has state - ' + params.data.state + ' is going to ' + params.data.action + ' while game is running.');
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// Validate if this standup or leave is allowed for this player
// > Spectator player cannot opt to standup

var validateAction = function (params, cb) {
  if(params.data.index < 0 && params.data.action === stateOfX.move.standup) {
    cb({success: false, channelId: params.channelId, info: "You are not allowed to " + params.data.action + ", please choose Leave."});
  } else {
    cb(null, params);
  }
};

// ### Validate if move exists for game ["CHECK", "CALL", "BET", "RAISE", "ALLIN", "FOLD"]

var updatePlayer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcLeaveRemote function updatePlayer');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(params.data.index >= 0) {
        params.table.players[params.data.index].state = stateOfX.playerState.onleave;
        params.data.roundName                         = params.table.players[params.data.index].roundName;
      }
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Validate player - right player to act

var isCurrentPlayer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcLeaveRemote function isCurrentPlayer');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(params.data.index >= 0) {
        serverLog(stateOfX.serverLogType.info,'Resetting isCurrentPlayer variable for ofcLeaveRemote');
        params.data.isCurrentPlayer = params.data.index === params.table.currentMoveIndex;
        serverLog(stateOfX.serverLogType.info,'Updated isCurrentPlayer - ' + params.data.isCurrentPlayer);
      }
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// Check if Game should over after this leave

var validateGameOver = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcMoveRemote function validateGameOver.');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      
      // if(ofcTableManager.isPlayerWithMove(params) === false) {
      //   serverLog(stateOfX.serverLogType.info, 'There are no players with move left into the game, Game Over!')
      //   params.table.state = stateOfX.gameState.gameOver;
      // }
      // 
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Remove from player array on table

var surrenderPlayer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcLeaveRemote function surrenderPlayer');
  if(params.data.index >= 0) {
    serverLog(stateOfX.serverLogType.info,'Removing player from table');
    imdb.removePlayerJoin({channelId: params.channelId, playerId: params.data.playerId}, function(err, response){
      if(!err && response) {
        // params.table.players.splice(params.data.index, 1); // Used in normal game, to remove player
        params.table.players[params.data.index] = stateOfX.playerState.surrender ;// Surrender player
        cb(null, params);
      } else {
        cb({success: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to remove player record in join - ' + JSON.stringify(err)});
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'Player hasnt taken seat, so removing from db records only, Running Game.');
    imdb.removePlayerJoin({channelId: params.channelId, playerId: params.data.playerId}, function(err, response){
      if(!err && response) {
        cb(null, params);
      } else {
        cb({success: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to remove player record in join - ' + JSON.stringify(err)});
      }
    });
  }
};

// ### Update first player index if
// > First active player left the game
var setfirstActiveIndex = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcLeaveRemote function setfirstActiveIndex');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {

      if(params.data.index === params.table.firstActiveIndex) {
        serverLog(stateOfX.serverLogType.info,'This is the first active player to dealer left the table.');
        params.table.firstActiveIndex = params.table.players[params.data.index].nextActiveIndex;
      }
      if(params.data.isCurrentPlayer) {
        serverLog(stateOfX.serverLogType.info,'This is the current player to leave.');
        serverLog(stateOfX.serverLogType.info,'Current player index- ' + params.table.currentMoveIndex);
        params.table.currentMoveIndex = params.table.players[params.table.currentMoveIndex].nextActiveIndex;
        serverLog(stateOfX.serverLogType.info,'Next player move set to next active index - ' + params.table.currentMoveIndex);
      }
      cb(null, params);

    } else {
      cb(isGameProgressResponse);
    }
  });
};

var setNextPlayerDetails = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcLeaveRemote function setNextPlayerDetails');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(params.data.state === stateOfX.playerState.playing) {
        if(params.data.isCurrentPlayer && _.where(params.table.players, {state: stateOfX.playerState.playing}).length > 1) {
            params.table.currentMoveIndex                                    = params.table.players[params.table.currentMoveIndex].nextActiveIndex;
            params.table.players[params.table.currentMoveIndex].currentCards = params.table.deck.slice(0, stateOfX.OFCplayerCards[params.table.players[params.table.currentMoveIndex].roundName]);
            params.table.deck.splice(0, stateOfX.OFCplayerCards[params.table.players[params.table.currentMoveIndex].roundName]);
            cb(null, params);
        } else {
          serverLog(stateOfX.serverLogType.info, 'Player was not the player with turn, so skipping turn transfer.');
          cb(null, params);
        }
      } else {
        serverLog(stateOfX.serverLogType.info, 'Player was not in PLAYING state, so skipping turn transfer.');
        cb(null, params);
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ###  Perform move handler

var createLeaveResponse = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcLeaveRemote function createLeaveResponse');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      serverLog(stateOfX.serverLogType.info,'creating response for Game over on leave ' + JSON.stringify(_.omit(params.table, 'deck')));
      // Set current time for player turn starts at
      if(params.data.isCurrentPlayer) {
        params.table.turnTimeStartAt = new Date().getTime();
      }
      params.data.success           = true;
      params.data.isGameOver        = false;
      params.data.winners           = isGameProgressResponse.winners;
      params.data.rakeDeducted      = isGameProgressResponse.rakeDeducted;
      params.data.cardsToShow       = isGameProgressResponse.cardsToShow;

      ofcResponseHandler.setActionKeys(params, function(setActionKeysResponse){
        cb(null, setActionKeysResponse);
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
  serverLog(stateOfX.serverLogType.info, 'in ofcLeaveRemote function adjustActiveIndexes');
  ofcAdjustIndex.perform(params, function(performResponse) {
    cb(null, performResponse.params);
  });
};

// ### Set params when game is not running

var setLeaveParams = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcLeaveRemote function setLeaveParams');
  serverLog(stateOfX.serverLogType.info, 'in ofcLeaveRemote function setLeaveParams - ' + JSON.stringify(params.table.players));
  params.data        = _.omit(params.data, '__route__');
  params.data.action = params.data.isStandup ? stateOfX.move.standup.toUpperCase() : stateOfX.move.leave.toUpperCase();
  params.data.index  = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
  serverLog(stateOfX.serverLogType.info,'Player at index - ' + params.data.index + ' is going to ' + params.data.action + ' !');
  cb(null, params);
};

// ### Refund amount to player after leave

var refundAmountOnLeave = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcLeaveRemote function refundAmountOnLeave');
  serverLog(stateOfX.serverLogType.info, 'TODO: refund player amount in OFC table - ' + params.data.action);
  cb(null, params);
};

var removePlayer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcLeaveRemote function removePlayer');
  if(params.data.index >= 0) {
    serverLog(stateOfX.serverLogType.info,'Removing player from table');
    imdb.removePlayerJoin({channelId: params.channelId, playerId: params.data.playerId}, function(err, response){
      if(!err && response) {
        // params.table.players.splice(params.data.index, 1);
        
        cb(null, params);
      } else {
        cb({success: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to store player record in join - ' + JSON.stringify(err)});
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'Player hasnt taken seat, so removing from db records only, Not running Game.');
    imdb.removePlayerJoin({channelId: params.channelId, playerId: params.data.playerId}, function(err, response){
      if(!err && response) {
        cb(null, params);
      } else {
        cb({success: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to store player record in join - ' + JSON.stringify(err)});
      }
    });
  }
  cb(null, params);
};

// ### generte response when player leave
// > no game running on table
var generateResponse = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcLeaveRemote function generateResponse');
  params.data.success = true;
  params.data.response = {
    success         : true,
    channelId       : params.channelId,
    isGameOver      : false,
    isCurrentPlayer : false,
    isRoundOver     : false,
    broadcast       : {
      success     : true,
      channelId   : params.channelId,
      playerId    : params.data.playerId,
      playerName  : params.data.playerName
    },
    turn : {},
    round: {},
    over : {},
    preChecks : []
  };

  cb(null, params);
};

// ### Handle all cases required to handle an action
// > Params: {self, channelId, table, data {channelId, playerId, amount, action, isRequested}, table}

// ofcLeaveRemote
module.exports.performLeave = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcLeaveRemote function leavePlayer');

  serverLog(stateOfX.serverLogType.info,'Players while leaving a player begins - ' + JSON.stringify(params.table.players));

  if(params.table.channelType === stateOfX.gameType.normal) {
    if(params.table.state === stateOfX.gameState.running) {
      async.waterfall([

        async.apply(initializeParams, params),
        validateAction,
        refundAmountOnLeave,
        updatePlayer,
        isCurrentPlayer,
        // adjustActiveIndexes,
        // validateGameOver,
        surrenderPlayer,
        // setNextPlayerDetails,
        // adjustActiveIndexes,
        createLeaveResponse
      ], function(err, response){
        if(err) {
          if(!!err.data && err.data.success) {
            cb({success: true, table: params.table, data: params.data});
          } else {
            serverLog(stateOfX.serverLogType.error, '1. This should not be success response for LEAVE - ' + JSON.stringify(err));
            cb(err);
          }
        } else {
          serverLog(stateOfX.serverLogType.info, 'Sending final leave broadcast on success case');
          cb({success: true, table: params.table, data: params.data});
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info,'Removing player when Game is - ' + params.table.state);
      async.waterfall([

        async.apply(setLeaveParams, params),
          validateAction,
          refundAmountOnLeave,
          surrenderPlayer,
          adjustActiveIndexes,
          generateResponse
      ], function(err, response){
        serverLog(stateOfX.serverLogType.info, '====== FINAL LEAVE RESPONSE IDLE =======');
        serverLog(stateOfX.serverLogType.info, JSON.stringify(err));
        serverLog(stateOfX.serverLogType.info, JSON.stringify(response));
        if(err) {
          serverLog(stateOfX.serverLogType.error, '2. This should not be success response for LEAVE - ' + JSON.stringify(err));
          cb(err);
        } else {
          cb({success: true, table: params.table, data: params.data});
        }
      });
    }
  } else {
    serverLog(stateOfX.serverLogType.info, "Not handling leave for table - " + params.table.channelType);
    cb({success: false, channelId: params.channelId, info: "Not handling leave for table - " + params.table.channelType});
  }
};