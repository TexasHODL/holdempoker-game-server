/*jshint node: true */
"use strict";

  /**
 * Created by Amrendra on 14/06/2016.
**/
var async              = require("async"),
    _ld                = require("lodash"),
    _                  = require('underscore'),
    stateOfX           = require("../../../../../shared/stateOfX"),
    keyValidator       = require("../../../../../shared/keysDictionary"),
    db                 = require("../../../../../shared/model/dbQuery.js"),
    imdb               = require("../../../../../shared/model/inMemoryDbQuery.js"),
    mongodb            = require('../../../../../shared/mongodbConnection'),
    zmqPublish         = require("../../../../../shared/infoPublisher"),
    decideWinner       = require("../../../../../shared/winnerAlgo/entry.js"),
    ofcAdjustIndex     = require('./ofcAdjustActiveIndex'),
    roundOver          = require('./ofcRoundOver'),
    ofcHandleGameOver  = require('./ofcHandleGameOver'),
    ofcResponseHandler = require('./ofcResponseHandler'),
    ofcTableManager    = require("./ofcTableManager");

var ofcMoveRemote = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'ofcMoveRemote';
  logObject.serverName   = stateOfX.serverType.database;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### Validate Game state to be RUNNING throughout performing move calculation

var isGameProgress = function(params, cb) {
  if(params.table.state === stateOfX.gameState.running) {
    cb({success: true, isGameOver: false, info: "Game state check in move, Game is still running."});
  } else {
    ofcHandleGameOver.processGameOver(params, function (gameOverResponse){
      serverLog(stateOfX.serverLogType.info, 'Game over response in ofcMoveRemote - ' + JSON.stringify(gameOverResponse));
      if(gameOverResponse.success) {
        params = gameOverResponse.params;
        params.data.success           = true;
        params.data.isGameOver        = true;
        params.data.winners           = gameOverResponse.params.data.winners;
        params.data.rakeDeducted      = gameOverResponse.params.data.rakeDeducted;
        params.data.action            = stateOfX.OFCmove.submit;
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
  serverLog(stateOfX.serverLogType.info, 'In ofcMoveRemote function initializeParams');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {

      params.data       = _.omit(params.data, '__route__');
      params.data.index = _ld.findIndex(params.table.players, {playerId: params.data.playerId, state: stateOfX.playerState.playing});
      // Check if player is in Disconnected state
      // In case auto turn for disconnected players
      if(params.data.index < 0) {
        params.data.index = _ld.findIndex(params.table.players, {playerId: params.data.playerId, state: stateOfX.playerState.disconnected});
        serverLog(stateOfX.serverLogType.info, 'Updated player index if disconnected - ' + params.data.index);
      }
      // Set Player Name
      params.data.isGameOver      = (params.table.state === stateOfX.gameState.gameOver);
      params.data.roundName       = params.table.roundName;
      params.data.playerName      = params.table.players[params.data.index].playerName;
      params.data.isCurrentPlayer = true;
      params.data.action          = stateOfX.OFCmove.submit;
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

var validateInputs = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcMoveRemote function validateInputs.');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(!!params.data.cards.top && !!params.data.cards.middle && !!params.data.cards.bottom) {
        var totalCards = params.data.cards.top.length + params.data.cards.middle.length + params.data.cards.bottom.length;
        var cardsArray = params.data.cards.top.concat(params.data.cards.middle, params.data.cards.bottom);
        if( (params.table.players[params.data.index].isInFantasyLand && totalCards >= 13)|| (totalCards) === stateOfX.OFCplayerCardsInRound[params.table.players[params.data.index].roundName]) {
          if(cardsArray.indexOf(null) < 0) {
            cb(null, params);
          } else {
            cb({success: false, channelId: params.channelId, info: "Cards are null - " + JSON.stringify(params.data.cards)});
          }
        } else {
          cb({success: false, channelId: params.channelId, info: "Not a valid move, check cards - " + JSON.stringify(params.data.cards)});
        }
      } else {
        cb({success: false, channelId: params.channelId, info: "Card rows missing - " + JSON.stringify(params.data.cards)});
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

var validatePlayer = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcMoveRemote function validatePlayer.');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(params.data.index >= 0) {
        if(params.table.players[params.data.index].seatIndex === params.table.players[params.table.currentMoveIndex].seatIndex) {
          cb(null, params);
        } else {
          cb({success: false, channelId: params.channelId, info: "You are not a valid player to take action!"});
        }
      } else {
        cb({success: false, channelId: params.channelId, info: "You are not sitting on the table!"});
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Set this player cards who just made move

var setPlayerCards = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcMoveRemote function setPlayerCards.');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      params.table.players[params.data.index].cards = params.data.cards;
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Set discarded cards for player who just made move

var setDiscardedCard = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcMoveRemote function setDiscardedCard.');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      params.table.players[params.data.index].discardedCard = params.data.discarded;
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

var getRoyalityPoints = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcMoveRemote function getRoyalityPoints.');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      // TODO: Get royality points for different rows
      var input = {};
      serverLog(stateOfX.serverLogType.info, 'before Inserting royalities in getRoyalityPoints ' + JSON.stringify(params.table.players[params.data.index]));
      if(params.table.players[params.data.index].royalities.top === -1 && params.table.players[params.data.index].cards.top.length === 3) {
        input.handType = "topHand";
        input.cards    = params.table.players[params.data.index].cards.top;
        serverLog(stateOfX.serverLogType.info, "input top hand is -))))))))) " + JSON.stringify(input) + '  and ' + decideWinner.findRoyalityForHand(input));
        params.table.players[params.data.index].royalities.top = decideWinner.findRoyalityForHand(input);
      }
      if(params.table.players[params.data.index].royalities.middle === -1 && params.table.players[params.data.index].cards.middle.length === 5) {
        input.handType = "middleHand";
        input.cards    = params.table.players[params.data.index].cards.middle;
        serverLog(stateOfX.serverLogType.info, "input middle hand is - " + JSON.stringify(input) + '  and ' + decideWinner.findRoyalityForHand(input));
        params.table.players[params.data.index].royalities.middle = decideWinner.findRoyalityForHand(input);
      }
      if(params.table.players[params.data.index].royalities.bottom === -1 && params.table.players[params.data.index].cards.bottom.length === 5) {
        input.handType = "bottomHand";
        input.cards    = params.table.players[params.data.index].cards.bottom;
        serverLog(stateOfX.serverLogType.info, "input bottom hand is - " + JSON.stringify(input) + '  and ' + decideWinner.findRoyalityForHand(input));
        params.table.players[params.data.index].royalities.bottom = decideWinner.findRoyalityForHand(input);
      }
      serverLog(stateOfX.serverLogType.info, 'after Inserting royalities in getRoyalityPoints ' + JSON.stringify(params.table.players[params.data.index]));
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Reset royality update values

var updateRoyalitySetValues = function(params, cb) {
  // serverLog(stateOfX.serverLogType.info, 'In ofcMoveRemote function updateRoyalitySetValues.');
  // serverLog(stateOfX.serverLogType.info, 'Player previous royalities - ' + JSON.stringify(params.table.players[params.data.index].royalitiesSet));
  // serverLog(stateOfX.serverLogType.info, 'Player previous royalities - ' + JSON.stringify(params.table.players[params.data.index].royalities));
  // if(!params.table.players[params.data.index].royalitiesSet.bottom) {
  //   if(params.table.players[params.data.index].royalities.bottom >= 0) {
  //     params.table.players[params.data.index].royalitiesSet.bottom = true;
  //   }
  // }
  // if(!params.table.players[params.data.index].royalitiesSet.middle) {
  //   if(params.table.players[params.data.index].royalities.middle >= 0) {
  //     params.table.players[params.data.index].royalitiesSet.middle = true;
  //   }
  // }
  // if(!params.table.players[params.data.index].royalitiesSet.top) {
  //   if(params.table.players[params.data.index].royalities.top >= 0) {
  //     params.table.players[params.data.index].royalitiesSet.top = true;
  //   }
  // }
  // serverLog(stateOfX.serverLogType.info, 'Player updated royalities - ' + JSON.stringify(params.table.players[params.data.index].royalitiesSet));
  cb(null, params);
};

var updatePlayer = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcMoveRemote function updatePlayer.');
  isGameProgress(params, function (isGameProgressResponse){
    serverLog(stateOfX.serverLogType.info, 'Before updating player OFC move - ' + JSON.stringify(params.table.players[params.data.index]));
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      params.table.players[params.data.index].roundName    = stateOfX.nextOFCroundOf[params.table.players[params.data.index].roundName];
      params.data.roundName                                = params.table.players[params.data.index].roundName;
      params.table.players[params.data.index].isPlayed     = true;
      params.table.players[params.data.index].currentCards = [];
      if(params.table.players[params.data.index].isInFantasyLand) {
        params.table.players[params.data.index].roundName    = stateOfX.ofcRound.finished;
        params.table.players[params.data.index].active       = false;
        params.table.players[params.data.index].nextGameCard = -1;
      }
      serverLog(stateOfX.serverLogType.info, 'After updating player OFC move - ' + JSON.stringify(params.table.players[params.data.index]));
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

var updateTable = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcMoveRemote function updateTable.');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

var validateGameOver = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcMoveRemote function validateGameOver.');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(ofcTableManager.isPlayerWithMove(params) === false) {
        serverLog(stateOfX.serverLogType.info, 'There are no players with move left into the game, Game Over!');
        params.table.state = stateOfX.gameState.gameOver;
      }
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

var adjustActiveIndexes = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcMoveRemote function adjustActiveIndexes.');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      ofcAdjustIndex.perform(params, function(performResponse) {
        serverLog(stateOfX.serverLogType.info, 'in ofcMoveRemote ofcAdjustIndex performResponse - ' + JSON.stringify(performResponse));
        cb(null, performResponse.params);
      });
    } else {
      cb(isGameProgressResponse);
    }
  });
};

var setNextPlayerDetails = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcMoveRemote function setNextPlayerDetails.');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      params.table.currentMoveIndex = params.table.players[params.data.index].nextActiveIndex;
      serverLog(stateOfX.serverLogType.info, 'Next player with move - ' + JSON.stringify(params.table.players[params.table.currentMoveIndex]));
      params.data.preRoundName = params.table.players[params.table.currentMoveIndex].roundName;
      var totalCardsToDistribute = params.table.players[params.table.currentMoveIndex].isInFantasyLand ? params.table.players[params.table.currentMoveIndex].nextGameCard : stateOfX.OFCplayerCards[params.table.players[params.table.currentMoveIndex].roundName];
      serverLog(stateOfX.serverLogType.info, 'Total cards to be distributed to this player - ' + totalCardsToDistribute);
      params.table.players[params.table.currentMoveIndex].currentCards = params.table.deck.slice(0, totalCardsToDistribute);
      params.table.deck.splice(0, totalCardsToDistribute);
      serverLog(stateOfX.serverLogType.info, 'Updated next player - ' + JSON.stringify(params.table.players[params.table.currentMoveIndex]));
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

var createMoveResponse = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcMoveRemote function createMoveResponse.');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(!params.table.players[params.table.currentMoveIndex].isInFantasyLand && params.table.players[params.table.currentMoveIndex].playerId == "1baf040a-4b73-49e4-885d-fba61963a4bf") {
        console.log('This is our player round - ' + params.table.players[params.table.currentMoveIndex].roundName);
        if(params.table.players[params.table.currentMoveIndex].roundName == stateOfX.ofcRound.one) {
          params.table.players[params.table.currentMoveIndex].currentCards = [{"type":"club","rank":2,"name":"2","priority":2},{"type":"club","rank":3,"name":"3","priority":3},{"type":"club","rank":4,"name":"4","priority":4},{"type":"club","rank":5,"name":"5","priority":5},{"type":"club","rank":6,"name":"6","priority":6}];
        } else if(params.table.players[params.table.currentMoveIndex].roundName == stateOfX.ofcRound.two) {
          params.table.players[params.table.currentMoveIndex].currentCards = [{"type":"heart","rank":1,"name":"A","priority":1},{"type":"diamond","rank":2,"name":"2","priority":2},{"type":"diamond","rank":7,"name":"7","priority":7}];
        } else if(params.table.players[params.table.currentMoveIndex].roundName == stateOfX.ofcRound.three) {
          params.table.players[params.table.currentMoveIndex].currentCards = [{"type":"heart","rank":3,"name":"3","priority":3}, {"type":"diamond","rank":4,"name":"4","priority":4},{"type":"diamond","rank":5,"name":"5","priority":5}];
        } else if(params.table.players[params.table.currentMoveIndex].roundName == stateOfX.ofcRound.four) {
          params.table.players[params.table.currentMoveIndex].currentCards = [{"type":"heart","rank":5,"name":"5","priority":5}, {"type":"club","rank":12,"name":"Q","priority":12},{"type":"diamond","rank":5,"name":"5","priority":5}];
        } else {
          params.table.players[params.table.currentMoveIndex].currentCards = [{"type":"heart","rank":12,"name":"Q","priority":12},{"type":"club","rank":3,"name":"3","priority":3},{"type":"diamond","rank":5,"name":"5","priority":5}];
        }
      } else {
        console.log('This is not our player.');
      }
      params.data.success = true;
      ofcResponseHandler.setActionKeys(params, function(setActionKeysResponse){
        // Set current time for player turn starts at
        params.table.turnTimeStartAt = new Date().getTime();
        cb(null, setActionKeysResponse);
      });
    } else{
      cb(isGameProgressResponse);
    }
  });
};

// ### Handle all cases required to handle an action
// > Params: {self, channelId, table, data {channelId, playerId, amount, action, isRequested}, table}

ofcMoveRemote.performMove = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcMoveRemote function ofcMoveRemote');
  params = _.omit(params, 'self');
  serverLog(stateOfX.serverLogType.info, 'Action perform params - ' + JSON.stringify(params));
  async.waterfall([

    async.apply(initializeParams, params),
    validatePlayer,
    validateInputs,
    setPlayerCards,
    setDiscardedCard,
    getRoyalityPoints,
    updateRoyalitySetValues,
    updatePlayer,
    updateTable,
    validateGameOver,
    setNextPlayerDetails,
    adjustActiveIndexes,
    createMoveResponse

  ], function (err, response){
    serverLog(stateOfX.serverLogType.info, 'err, response for ofc move performMove');
    serverLog(stateOfX.serverLogType.error, 'err - ' + JSON.stringify(err));
    serverLog(stateOfX.serverLogType.info, 'response - ' + JSON.stringify(response));
    if(err) {
      if(!!err.data && err.data.success) {
        cb({success: true, table: err.table, data: err.data});
      } else {
        // Setting keys if false response and client need to reset view
        // of player cards, will send broadcast from ofcHandler ofcMakeMove false response

        err.data           = {};
        err.data.cards     = params.table.players[params.data.index].cards;
        err.data.discarded = params.table.players[params.data.index].discardedCard;
        err.data.playerId  = params.table.players[params.data.index].playerId;
        err.data.channelId = params.channelId;

        cb(err);
      }
    } else {
      cb({success: true, table: params.table, data: params.data});
    }
  });
};

module.exports = ofcMoveRemote;
