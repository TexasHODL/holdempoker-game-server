/*jshint node: true */
"use strict";

// This file is used to validate if game is going to start or noe.

var async           = require("async"),
    _ld             = require("lodash"),
    _               = require("underscore"),
    cardAlgo        = require("../../../../util/model/deck"),
    randy           = require("../../../../util/model/randy"),
    stateOfX        = require("../../../../../shared/stateOfX"),
    keyValidator    = require("../../../../../shared/keysDictionary"),
    db              = require("../../../../../shared/model/dbQuery"),
    zmqPublish      = require("../../../../../shared/infoPublisher"),
    ofcAdjustIndex  = require('./ofcAdjustActiveIndex'),
    ofcTableManager = require('./ofcTableManager');
const configConstants = require('../../../../../shared/configConstants');

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'ofcValidateGameStart';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// var ofcValidateGameStart = {};
function ofcValidateGameStart() {}

// ### Set all waiting players as playing player

var setWaitingAsPlaying = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In ofcValidateGameStart function setWaitingAsPlaying');
  async.each(params.table.players, function(player, ecb){
    serverLog(stateOfX.serverLogType.info, 'Processing player - ' + JSON.stringify(player));
    if(player.state === stateOfX.playerState.waiting) {
      player.state       = stateOfX.playerState.playing;
      player.active      = true;
      player.roundName   = stateOfX.ofcRound.one;
      // player.cards.top    =  params.table.deck.slice(0, 3);
      // params.table.deck.splice(0, 3);
      // player.cards.middle =  params.table.deck.slice(0, 5);
      // params.table.deck.splice(0, 5);
      // player.cards.bottom =  params.table.deck.slice(0, 5);
      // params.table.deck.splice(0, 5);
      ecb();
      serverLog(stateOfX.serverLogType.info, 'Updated player - ' + JSON.stringify(player));
    } else {
      ecb();
    }
  }, function(err){
    if(err) {
      cb({success: false, channelId: params.channelId, info: "Setting waiting player as playing failed."});
    } else {
      cb(null, params);
    }
  });
};


// ### Sort players indexes
// > (NOTE: Keep non-playng players at the end of players array list)

var sortPlayerIndexes = function (params, cb) {
  params.table.players.sort(function(a, b) { return parseInt(a.seatIndex) - parseInt(b.seatIndex); });
  var playingPlayers = [];
  var inactivePlayer = [];
  async.each(params.table.players, function(player, ecb){
    if(player.state !== stateOfX.playerState.playing) {
      serverLog(stateOfX.serverLogType.info, player.playerName + ' is not playing, add at last place!');
      inactivePlayer.push(player);
    } else {
      playingPlayers.push(player);
      serverLog(stateOfX.serverLogType.info, player.playerName + ' is already playing, add at first place!');
    }
    ecb();
  }, function(err){
    if(err) {
      cb({success: false, channelId: params.channelId, info: "Sorting players on game start failed."});
    } else {
      params.table.players = playingPlayers.concat(inactivePlayer); // Directly store sorted players into table players array
      serverLog(stateOfX.serverLogType.info, 'Final sorted players - ' + JSON.stringify(params.table.players));
      cb(null, params);
    }
  });
};

// Remove sitout players based on validation condition

var removeSitoutPlayer = function (params, cb) {
  if(params.table.channelType !== stateOfX.gameType.tournament) {
    async.each(params.table.players, function (player, ecb) {
      serverLog(stateOfX.serverLogType.info, 'Processing player while checking to remove from table or not - ' + JSON.stringify(player));
      serverLog(stateOfX.serverLogType.info, 'Allowed sitout game play - ' + configConstants.ofcRemoveSitoutMissedGame);
      serverLog(stateOfX.serverLogType.info, 'Is sitout game play missed exceed - ' + (player.bigBlindMissed >= params.table.blindMissed));
      if((parseInt(player.sitoutGameMissed) >= parseInt(configConstants.ofcRemoveSitoutMissedGame)) || (player.state === stateOfX.playerState.surrender)) {
        serverLog(stateOfX.serverLogType.info, "in chekcing blind condition");
        params.player = player;
        serverLog(stateOfX.serverLogType.info, "Going to splice player from table!");
        params.response.data.removed.push(params.player.playerId);
        params.table.players.splice(_ld.findIndex(params.table.players, player), 1);
        serverLog(stateOfX.serverLogType.info, "Players after removing this player from table: " + JSON.stringify(params.table.players));
      } else {
        ecb();
      }
    }, function (err) {
      if(err) {
        cb({success: false, channelId: params.channelId, info: "Removing sitout player failed !"});
      } else {
        cb(null, params);
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.info, "This is tournament so skipping sitout option");
    cb(null, params);
  }
};

// ### If enough players to start the game
var isEnoughPlayingPlayers = function (params, cb) {
  if(_.where(params.table.players, {state: stateOfX.playerState.playing}).length >= params.table.minPlayers) {
    params.data.startGame = true;
    cb(null, params);
  } else {
    cb({success: false, channelId: params.channelId, info: "Less min playing players to start game."});
  }
};

// ### Shuffle deck using RNG algo -
var shuffleDeck = function (params, cb) {
  keyValidator.validateKeySets("Request", params.serverType, "shuffleDeck", params, function (validated){
    if(validated.success) {
      params.table.deck = cardAlgo.getCards();
      params.table.deck = randy.shuffle(params.table.deck);
      cb(null, params);
    } else {
      cb(validated);
    }
  });
};

var initializeParams = function (params) {
  params.data              = {};
  params.data.state        = params.table.state;
  params.data.removed      = [];
  params.data.players      = params.table.players;
  params.data.startGame    = false;
  params.data.success      = false;
  params.data.preGameState = params.table.state;
};

var resetTableOnNoGameStart = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Resetting table in Game not start condition.');
  async.each(params.table.players, function(player, ecb){
    if(player.state === stateOfX.playerState.playing){
      player.state  = stateOfX.playerState.waiting;
      ecb();
    } else {
      ecb();
    }
  }, function(err){
    if(err) {
      cb({success: false, channelId: params.channelId, info: "Resetting players on no game start failed."});
    } else {
      params.data.players              = params.table.players;
      params.table.state               = stateOfX.gameState.idle;
      params.table.roundName           = null;
      params.table.dealerSeatIndex     = -1;
      params.table.nextDealerSeatIndex = -1;
      params.table.dealerIndex         = 0;
      params.table.currentMoveIndex    = 1;
      params.table.firstActiveIndex    = 1;
      params.table.turnTimeStartAt     = null;
      params.table.isOperationOn       = false;
      params.table.actionName          = "";
      cb({success: true, params: params, info: "Table reset successfully on no game start case."});
    }
  });
};

var adjustActiveIndexes = function(params, cb) {
  ofcAdjustIndex.perform(params, function(performResponse) {
    serverLog(stateOfX.serverLogType.info, 'in handleGameStartCase performResponse - ' + JSON.stringify(performResponse));
    cb(null, performResponse.params);
  });
};

var setDealerPlayer = function (params, cb){
  serverLog(stateOfX.serverLogType.info, 'In function setDealerPlayer.');
  if(params.data.startGame) {
    params.table.dealerIndex         = 0;
    params.table.dealerSeatIndex     = params.table.players[params.table.dealerIndex].seatIndex;
    params.table.nextDealerSeatIndex = params.table.players[params.table.dealerIndex].nextActiveIndex;
    cb(null, params);
  } else {
    cb({success: false, channelId: params.channelId, info: "Game is not going to start, skipping setting dealer."});
  }
};

var setCurrentPlayer = function (params, cb){
  serverLog(stateOfX.serverLogType.info, 'In function setCurrentPlayer.');
  if(params.data.startGame) {
    params.table.currentMoveIndex = params.table.players[params.table.dealerIndex].nextActiveIndex;
    cb(null, params);
  } else {
    cb({success: false, channelId: params.channelId, info: "Game is not going to start, skipping setting current player."});
  }
};

var distributeCard = function (params, cb){
  serverLog(stateOfX.serverLogType.info, 'In function distributeCard. => ' + JSON.stringify(params.table));
  if(params.data.startGame) {
    var count = params.table.players[params.table.currentMoveIndex].isInFantasyLand ? params.table.players[params.table.currentMoveIndex].nextGameCard : 5;
    if(count >= 0) {
      ofcTableManager.popCard({table: params.table, count: count}, function(popCardResponse){
        if(popCardResponse.success) {
          params.table.players[params.table.currentMoveIndex].currentCards = popCardResponse.cards;
          cb(null, params);
        } else {
          cb(popCardResponse);
        }
      });
    } else {
      cb({success: false, channelId: params.channelId, info: "Illegal card number " + count + " to be distribute on game start to player - " + JSON.stringify(params.table.players[params.table.currentMoveIndex])});
    }
  } else {
    cb({success: false, channelId: params.channelId, info: "Game is not going to start, skipping card distribution."});
  }
};

var setTableAttributes = function (params, cb){
  serverLog(stateOfX.serverLogType.info, 'In function setTableAttributes.');
  if(params.data.startGame) {
    params.table.state     = stateOfX.gameState.running;
    params.table.roundName = stateOfX.ofcRound.one;
    cb(null, params);
  } else {
    cb({success: false, channelId: params.channelId, info: "Game is not going to start, skipping setting table attributes."});
  }
};

var setStartGameResponse = function(params, cb){
  serverLog(stateOfX.serverLogType.info, 'Dealer index - ' + params.table.dealerIndex + ' Current player index - ' + params.table.currentMoveIndex + ' in players.');
  params.data.currentMoveIndex = params.table.players[params.table.currentMoveIndex].seatIndex;
  params.data.dealerIndex      = params.table.players[params.table.dealerIndex].seatIndex;
  params.data.roundName        = params.table.roundName;
  params.data.currentCards     = params.table.players[params.table.currentMoveIndex].currentCards;
  params.data.currentPlayerId  = params.table.players[params.table.currentMoveIndex].playerId;
  params.data.state            = params.table.state;

  // Create key for log generation
  params.data.tableDetails                              =  {};
  params.data.tableDetails.channelVariation             =  params.table.channelVariation;
  params.data.tableDetails.isPotLimit                   =  params.table.isPotLimit;
  params.data.tableDetails.isRealMoney                  =  params.table.isRealMoney;
  params.data.tableDetails.channelName                  =  params.table.channelName;
  params.data.tableDetails.dealerSeatIndex              =  params.table.players[params.table.dealerIndex].seatIndex;
  params.data.tableDetails.isCurrentPlayerInFantasyLand =  params.table.players[params.table.currentMoveIndex].isInFantasyLand;

  cb(null, params);
};

ofcValidateGameStart.ofcShouldStartGame = function (params, cb) {
  initializeParams(params);

  if(params.table.state === stateOfX.gameState.idle) {
    async.waterfall([
      async.apply(setWaitingAsPlaying, params),
      sortPlayerIndexes,
      removeSitoutPlayer,
      isEnoughPlayingPlayers,
      shuffleDeck,
      adjustActiveIndexes,
      setDealerPlayer,
      setCurrentPlayer,
      distributeCard,
      setTableAttributes,
      setStartGameResponse
    ], function(err, response){
      if(!err && response) {
        serverLog(stateOfX.serverLogType.info, 'On Game start table set - ' + JSON.stringify(params.table));
        params.data.success = true;
        cb({success: true, table: params.table, data: params.data});
      } else {
        params.data.info = err.info;
        resetTableOnNoGameStart(params, function(res){
          if(res.success) {
            cb({success: false, table: res.params.table, data: res.params.data});
          } else {
            cb(res);
          }
        });
      }
    });
  } else{
    serverLog(stateOfX.serverLogType.info, 'Trying to start a Game with state - ' + params.table.state);
    cb({success: false, table: params.table, data: params.data});
  }
};

module.exports = ofcValidateGameStart;