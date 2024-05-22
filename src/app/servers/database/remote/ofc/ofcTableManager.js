/*jshint node: true */
"use strict";

// This file is used to manipulate table operations
var _ld          = require("lodash"),
    _            = require("underscore"),
    async        = require("async"),
    cardAlgo     = require("../../../../util/model/deck"),
    stateOfX     = require("../../../../../shared/stateOfX"),
    zmqPublish   = require("../../../../../shared/infoPublisher"),
    db           = require("../../../../../shared/model/dbQuery"),
    profileMgmt  = require("../../../../../shared/model/profileMgmt"),
    imdb         = require("../../../../../shared/model/inMemoryDbQuery.js"),
    keyValidator = require("../../../../../shared/keysDictionary");

var ofcTableManager = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'ofcTableManager';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### Get table from database
ofcTableManager.getTableObject = function (params, cb) {
  cb({success: true, table: params.table});
};

// ### Get table from database
ofcTableManager.createOFCtable = function (params, cb) {
  var table = {
    channelId           : params.channelId,
    channelType         : params.channelType,
    channelName         : params.channelName,
    channelVariation    : params.channelVariation,
    turnTime            : params.turnTime,
    maxPlayers          : (params.maxPlayers >= 0 ? params.maxPlayers : 3),
    minPlayers          : (params.minPlayers >= 0 ? params.minPlayers : 2),
    minBuyIn            : params.minBuyIn,
    maxBuyIn            : params.maxBuyIn,
    gameInfo            : params.gameInfo,
    isRealMoney         : params.isRealMoney,
    chipsPointRatio     : params.chipsPointRatio,
    rakeRules           : null,
    rake                : null,
    // gameInfo            : params.gameInfo,
    roundId             : null,
    state               : stateOfX.ofcGameState.idle,
    roundCount          : 0,
    deck                : cardAlgo.getCards(),
    players             : [],
    queueList           : [],
    handHistory         : [],
    roundName           : null,
    dealerSeatIndex     : -1,
    nextDealerSeatIndex : -1,
    dealerIndex         : 0,
    currentMoveIndex    : 1,
    firstActiveIndex    : 1,
    turnTimeStartAt     : null,
    isOperationOn       : false,
    actionName          : "",
    operationStartTime  : null,
    operationEndTime    : null,
    gameStartTime       : null,
    _v                  : 1
  };

  imdb.saveTable(table, function (err, data) {
    serverLog(stateOfX.serverLogType.info, "data in createTable");
    serverLog(stateOfX.serverLogType.info, JSON.stringify(data));
    if(err) {
      cb({success: false, channelId: params.channelId, info: 'Error while saving table in db - ' + err});
    } else {
      keyValidator.validateKeySets("Response", "database", "createTable", {success: true, table: table}, function (validated){
        if(validated.success) {
          cb({success: true, channelId: params.channelId, table: table, info: "Table in inmemory database created successfully !"});
        } else {
          cb(validated);
        }
      });
    }
  });
};

// Generate a player object using default values
ofcTableManager.addPlayerAsWaiting = function(params, cb) {
  var player =  {
    playerId         : params.data.playerId,
    channelId        : params.data.channelId,
    playerName       : params.data.playerName,
    networkIp        : params.data.networkIp,
    points           : parseInt(params.data.points),
    seatIndex        : parseInt(params.data.seatIndex),
    imageAvtar       : params.data.imageAvtar,
    isAutoReBuy      : params.data.isAutoReBuy,
    state            : params.data.state || stateOfX.playerState.waiting,
    cards            : {top: [], middle: [], bottom: []},
    currentCards     : [],
    discardedCard    : [],
    preActiveIndex   : -1,
    nextActiveIndex  : -1,
    autoReBuyAmount  : 0,
    sitoutGameMissed : 0,
    roundName        : "",
    isFoul           : false,
    active           : false,
    isDisconnected   : false,
    isPlayed         : false,
    sitoutNextHand   : false,
    autoSitout       : false,
    isInFantasyLand  : false,
    nextGameCard     : -1,
    royalities       : {top: -1, middle: -1, bottom: -1},
    royalitiesSet    : {top: false, middle: false, bottom: false},
    activityRecord: {
      seatReservedAt: !!params.state && params.state === stateOfX.playerState.reserved ? new Date() : null,
      lastMovePlayerAt: null,
      disconnectedAt: null,
      lastActivityAction: "",
      lastActivityTime: Number(new Date())
    }
   };
  params.table.players.push(player);
  serverLog(stateOfX.serverLogType.info, 'Total players after this playerd added - ' + JSON.stringify(params.table.players));
  cb({success: true, table: params.table, data: {success: true, table: params.table, player: player}});
};

// ### Get total active players on table
//
ofcTableManager.totalActivePlayers = function (params, cb) {
  cb({success: true, players: _.where(params.table.players, {state: stateOfX.playerState.playing, active: true})});
};

// ### Get next suitable index from array
// > Includes condition to handle array limits management

ofcTableManager.getNextSuitableIndex = function (index, length) {
  if(index+1 > length-1) {
    return 0;
  } else {
    return (index+1);
  }
};

// ### Get previous suitable index from array
// > Includes condition to handle array limits management
ofcTableManager.getPreSuitableIndex = function (index, length) {
  if(index-1 < 0) {
    return (length-1);
  } else {
    return (index-1);
  }
};

// ### Get number of cards from deck

ofcTableManager.popCard = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in ofcTableManager - popCard');
  keyValidator.validateKeySets("Request", "database", "popCard", params, function (validated){
    if(validated.success) {
      var cards = params.table.deck.slice(0, params.count);
      params.table.deck.splice(0, params.count);
      cb({success: true, cards: cards, info: "Cards taken from deck successfully."});
    } else {
      cb(validated);
    }
  });
};

// ### conditions of game over
ofcTableManager.isPlayerWithMove = function (params) {
  serverLog(stateOfX.serverLogType.info,"params is in isPlayerWithMove in ofcTableManager- " + JSON.stringify(params));
  var totalActivePlayingPlayers = _.where(params.table.players, {active: true, state: stateOfX.playerState.playing});
  serverLog(stateOfX.serverLogType.info,"totalActivePlayingPlayers in isPlayerWithMove in ofcTableManager- " + JSON.stringify(totalActivePlayingPlayers));

  var totalFinishedPlayers  = _.where(totalActivePlayingPlayers, {roundName: stateOfX.ofcRound.finished});
  serverLog(stateOfX.serverLogType.info,"totalFinishedPlayers in isPlayerWithMove in ofcTableManager- " + JSON.stringify(totalFinishedPlayers));

  // if(totalActivePlayingPlayers.length <= 1) { // In case of leave/standup player Game Over
  //   serverLog(stateOfX.serverLogType.info, 'There is no active player left in the Game in ofcTableManager - GAME OVER!');
  //   return false
  // }
  
  if(totalActivePlayingPlayers.length === totalFinishedPlayers.length) { // if all active players played final round
    serverLog(stateOfX.serverLogType.info, 'All players played their last round in the Game in ofcTableManager - GAME OVER!');
    return false;
  }

  return true;
};


ofcTableManager.deductChipsInOfc = function(params,cb) {
  serverLog(stateOfX.serverLogType.info,"params is in deduct chips in ofcTableManager- " + JSON.stringify(params));
  keyValidator.validateKeySets("Request", "connector", "deductChipsInOfc", params, function (validated){
    if(validated.success) {
      var chips = params.table.chipsPointRatio * params.points;
      profileMgmt.deductChips({playerId: params.playerId, isRealMoney: params.table.isRealMoney, chips: chips, channelId: params.table.channelId}, function(deductChipsResponse) {
        cb(deductChipsResponse);
      });
    } else {
      cb(validated);
    }
  });
};

ofcTableManager.addChipsInOfc = function(params,cb) {
  serverLog(stateOfX.serverLogType.info,"params is in add chips in ofcTableManager- " + JSON.stringify(params));
  keyValidator.validateKeySets("Request", "connector", "addChipsInOfc", params, function (validated){
    if(validated.success) {
      var chips = params.table.chipsPointRatio * params.points;
      profileMgmt.addChips({playerId: params.playerId, isRealMoney: params.table.isRealMoney, chips: chips, channelId: params.table.channelId}, function(addChipsResponse) {
        cb(addChipsResponse);
      });
    } else {
      cb(validated);
    }
  });
};

// ### Add additional amount on players in game chips, on player request

ofcTableManager.ofcAddPointsOnTable = function (params, cb) {
  serverLog(stateOfX.serverLogType.info,"params is in ofcAddPointsOnTable in ofcTableManager- " + JSON.stringify(params));
  var chips = params.table.chipsPointRatio * params.data.amount;
  var playerIndexOnTable  = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
  var canAddChips = false;
  params.data.channelId = params.table.channelId;
  if(playerIndexOnTable >= 0) {
    var player = params.table.players[playerIndexOnTable];
    params.data.previousState      = player.state;
    serverLog(stateOfX.serverLogType.info, 'Player details for whome add chips requested - ' + JSON.stringify(player));
    if(parseInt(player.points) + parseInt(params.data.amount) <= parseInt(params.table.maxBuyIn) && parseInt(player.points) + parseInt(params.data.amount) >= parseInt(params.table.minBuyIn)) {
      switch(player.state) {
        case stateOfX.playerState.waiting     : serverLog(stateOfX.serverLogType.info, '1. Players is in state - ' + player.state); canAddChips = true; break;
        case stateOfX.playerState.onBreak     : serverLog(stateOfX.serverLogType.info, '2. Players is in state - ' + player.state); canAddChips = true; break;
        case stateOfX.playerState.outOfMoney  : serverLog(stateOfX.serverLogType.info, '3. Players is in state - ' + player.state); canAddChips = true; break;
        case stateOfX.playerState.reserved    : serverLog(stateOfX.serverLogType.info, '4. Players is in state - ' + player.state); canAddChips = true; break;
        default                               : serverLog(stateOfX.serverLogType.info, '5. Players is in state - ' + player.state); canAddChips = false; break;
      }

      if(canAddChips) {
        // Set current player state as waiting if RESERVED seat player requested to add chips
        if(params.table.channelType === stateOfX.gameType.normal) {
          profileMgmt.deductChips({playerId: player.playerId,isRealMoney: params.table.isRealMoney, chips: chips, channelId: params.channelId},function(deductChipsResponse){
            if(deductChipsResponse.success){

              // Set player state waiting if in reserved after successfull addition of chips
              if(player.state === stateOfX.playerState.reserved) {
                player.state = stateOfX.playerState.waiting;
              }

              params.data.success    = true;
              player.points          = parseInt(player.points) + parseInt(params.data.amount);
              player.onSitBuyIn      = player.points;
              params.data.amount     = player.points;
              params.data.state      = player.state;
              params.data.playerName = player.playerName;

              cb({success: true, data: params.data, table: params.table});
            } else{
              deductChipsResponse.state = player.state;
              cb(deductChipsResponse);
            }
          });
        } else{
          cb(null,params);
        }
      } else {
        cb({success: false, channelId: params.channelId, info: "You are not allowed to add chips!"});
      }
    } else {
      cb({success: false, channelId: params.channelId, info: "You can add chips between - " + params.table.minBuyIn + " - " + params.table.maxBuyIn});
    }
  } else {
    cb({success: false, channelId: params.channelId, info: "Invalid attempt to add chips, Please take a seat first!"});
  }
};

module.exports = ofcTableManager;