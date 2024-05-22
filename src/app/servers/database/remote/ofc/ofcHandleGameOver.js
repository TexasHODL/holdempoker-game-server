/*jshint node: true */
"use strict";

 /**
 * Created by Amrendra on 05/07/2016.
**/
var async             = require("async"),
    _ld               = require("lodash"),
    _                 = require('underscore'),
    stateOfX          = require("../../../../../shared/stateOfX"),
    keyValidator      = require("../../../../../shared/keysDictionary"),
    imdb              = require("../../../../../shared/model/inMemoryDbQuery.js"),
    mongodb           = require('../../../../../shared/mongodbConnection'),
    db                = require("../../../../../shared/model/dbQuery.js"),
    zmqPublish        = require("../../../../../shared/infoPublisher"),
    decideWinner      = require("../../../../../shared/winnerAlgo/entry.js"),
    tableManager      = require('./ofcTableManager'),
    deductRake        = require('./ofcDeductRake'),
    rewardRake        = require('./ofcRewardRake');

function ofcHandleGameOver() {}

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'ofcHandleGameOver';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

var initializeParams = function(params, cb) {
    params.data                     = _.omit(params.data, '__route__');
    params.data.winners             = [];
    params.data.endingType          = stateOfX.endingType.gameComplete;
    params.data.rakeDeducted        = 0;
    cb(null, params);
};


// ### set decision params for winning algo
var setDecisionParams = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcHandleGameOver function setDecisionParams');
  params.data.decisionParams = [];
  async.eachSeries(params.table.players, function(player, escb) {
    serverLog(stateOfX.serverLogType.info, 'Processing player for setting decision params - ' + JSON.stringify(player));
    if(player.state === stateOfX.playerState.playing) {
      params.data.decisionParams.push({
        playerId        : player.playerId,
        points          : 0,
        isFoul          : true,
        handsWon        : 0,
        isInFantasyLand : false,
        fantasyLandCards: 0,
        royalities      : { top : 0, middle : 0,bottom : 0 },
        bottomHand      : player.cards.bottom,
      	middleHand      : player.cards.middle,
      	topHand         : player.cards.top,
        isScoop         : false,
        wonFoulPoints   : 0,
        pointDetails    : { top : 0, middle : 0,bottom : 0 },
        currentPoints   : player.points
      });
      escb();
    } else {
      serverLog(stateOfX.serverLogType.info, 'Not including player - ' + player.playerName + ' as state - ' + player.state);
      escb();
    }
  }, function(err) {
    if(err) {
      serverLog(stateOfX.serverLogType.info, 'error in aynsc in preparing decisionParams');
      cb({success: false, info: "Error in set decision params in game over"});
    } else {
      serverLog(stateOfX.serverLogType.info, 'Decision params for Game over calculation - ' + JSON.stringify(params.data.decisionParams));
      cb(null, params);
    }
  });
};

// ### Reset table values on game over
var resetTableOnGameOver = function(params, cb) {
  params.table.state       = stateOfX.ofcGameState.idle;
  params.table.handHistory = [];
  cb(null, params);
};

var deductAutoBuyIn = function(params,cb){
  cb(null, params);
};

// ### Reset players attributes on game over

var resetPlayersOnGameOver = function(params, cb) {
  async.eachSeries(params.table.players, function(player, escb) {
    // Set player state based on different condition
    
    // Change state for bankrupt players
    player.state = player.chips <= 0 ? stateOfX.playerState.outOfMoney : player.state;
    serverLog(stateOfX.serverLogType.info, 'Player state after checking chips - ' + player.state);

    player.state = player.chips > 0 && player.state === stateOfX.playerState.outOfMoney ? stateOfX.playerState.playing : player.state;
    serverLog(stateOfX.serverLogType.info, 'Player state after checking chips and OUTOFMONEY state - ' + player.state);

    // Set player state SITOUT for those players who have opted
    // > to sit out in next hand
    player.state = (player.sitoutNextHand) ? stateOfX.playerState.onBreak : player.state;
    serverLog(stateOfX.serverLogType.info, 'Player state after checking sitout next hand - ' + player.state);
   
    player.cards            = {top: [], middle: [], bottom: []};
    player.currentCards     = [];
    player.discardedCard    = [];
    player.roundName        = stateOfX.ofcRound.one;
    player.isFoul           = false;
    player.isDisconnected   = false;
    player.isPlayed         = false;
    player.active           = true;
    player.royalities       = {top: -1, middle: -1, bottom: -1};
    escb();
  }, function(err) {
    if(err) {
      cb({success: false, channelId: params.channelId, info: "Error in reset players"});
    } else {
      cb(null, params);
    }
  });
};

// ### Decide winner using algos for different variations
var decideTableWinner = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcHandleGameOver function decideTableWinner - ' + JSON.stringify(params.data.decisionParams));
  params.data.ofcWinnerResponse = decideWinner.findOfcpWinner(params.data.decisionParams);
  serverLog(stateOfX.serverLogType.info, 'ofcWinnerResponse is - ' + JSON.stringify(params.data.ofcWinnerResponse));
  cb(null, params);
};

// ### Add winning chips into player's chips on table
var awardWinningPoints = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcHandleGameOver function awardWinningPoints');
  async.eachSeries(params.table.players, function(player, escb) {
    if(player.state === stateOfX.playerState.playing) {
      var playerInWinners = _.where(params.data.ofcWinnerResponse, {playerId: player.playerId});
      serverLog(stateOfX.serverLogType.info, 'Table player inside winner - ' + JSON.stringify(playerInWinners));
      if(playerInWinners.length > 0) {
        player.points          += playerInWinners[0].points;
        player.isInFantasyLand = playerInWinners[0].isInFantasyLand;
        player.nextGameCard    = playerInWinners[0].fantasyLandCards;
        escb();
      } else {
        cb({success: false, channelId: params.channelId, info: "Error in add award winning chips on table on game over"});
      }
    } else {
      serverLog(stateOfX.serverLogType.info, 'Not including player - ' + player.playerName + ' while awarding winner, as state - ' + player.state);
      escb();
    }
  },function(err) {
    if(err) {
      cb({success: false, channelId: params.channelId, info: "Add reward after game over failed."});
    } else {
      serverLog(stateOfX.serverLogType.info, 'OFC winning award added successfully.');
      cb(null, params);
    }
  });
};

var deductTableRake = function(params, cb) {
    cb(null, params);
};

// ### Create winning response
var createWinningResponse = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcHandleGameOver function createWinningResponse');
  async.eachSeries(params.data.ofcWinnerResponse, function(player, escb) {
    var tablePlayer = _.where(params.table.players, {playerId: player.playerId});
    if(tablePlayer.length > 0) {
      params.data.winners.push({
        playerId       : player.playerId,
        winningPoints  : player.points,
        isFoul         : player.isFoul,
        points         : tablePlayer[0].points,
        isScoop        : player.isScoop,
        pointDetails   : player.pointDetails,
      });
      escb();
    } else {
      serverLog(stateOfX.serverLogType.info, 'Erorr in getting table player points in create winningResponse');
      cb({success: false, info: "Erorr in getting table player points in create winningResponse"});
    }
  }, function(err) {
    if(err) {
      serverLog(stateOfX.serverLogType.info, 'Error in creating winner response in ofcHandleGameOver');
      cb({success: false, info: "Error in creating winner response"});
    } else {
      serverLog(stateOfX.serverLogType.info, 'Successfully created winner response in ofcHandleGameOver');
      cb(null, params);
    }
  });
};

// ### Adjust active player indexes among each other
// > Set preActiveIndex and nextActiveIndex values for each player
// > Used for turn transfer importantly
var adjustActiveIndexes = function(params, cb) {
    cb(null, params);
};

// ### Generate game over response
var createGameOverResponse = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "in createGameOverResponse in game over");
  params.data.success = true;
  cb(null, {
    success : true,
    params  : params
  });
};


ofcHandleGameOver.processGameOver = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcHandleGameOver function processGameOver');
  serverLog(stateOfX.serverLogType.info, "=========== OFC GAME OVER CALCULATION STARTED ===========");
  serverLog(stateOfX.serverLogType.info, "Request input - " + JSON.stringify(params));
  keyValidator.validateKeySets("Request", "database", "processGameOver", params, function(validated){
    if(validated.success) {
      async.waterfall([

        async.apply(initializeParams, params),
        setDecisionParams,
        decideTableWinner,
        deductTableRake,
        awardWinningPoints,
        deductAutoBuyIn,
        resetPlayersOnGameOver,
        resetTableOnGameOver,
        adjustActiveIndexes,
        createWinningResponse,
        createGameOverResponse

      ], function(err, response){
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

module.exports = ofcHandleGameOver;