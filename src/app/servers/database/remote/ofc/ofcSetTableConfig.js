/*jshint node: true */
"use strict";

var async           = require("async"),
    _ld             = require("lodash"),
    _               = require("underscore"),
    uuid            = require("uuid"),
    stateOfX        = require("../../../../../shared/stateOfX"),
    keyValidator    = require("../../../../../shared/keysDictionary"),
    zmqPublish      = require("../../../../../shared/infoPublisher"),
    db              = require("../../../../../shared/model/dbQuery"),
    adjustIndex     = require('./ofcAdjustActiveIndex'),
    tableManager    = require("./ofcTableManager"),
    setTableConfig  = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'setTableConfig';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### Set Game state as Running
// > Gem state, Occupied seat count, Vacant seat count and Round Id

var updateTableEntitiesOnGameStart = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig updateTableEntitiesOnGameStart');
  params.table.state          = stateOfX.gameState.running;
  params.table.pot            = [];
  params.table.occupiedSeats  = params.table.players.length;
  params.table.vacantSeats    = params.table.maxPlayers - params.table.players.length;
  params.table.roundId        = uuid.v4();
  params.table.onStartPlayers = _.pluck(params.table.players, 'playerId');
  params.table.summaryOfAllPlayers = {};
  serverLog(stateOfX.serverLogType.info, "occupiedSeats and vacantSeats are in updateTableEntitiesOnGameStart in setTableConfig - ",params.table.occupiedSeats,params.table.vacantSeats);
  cb(null, params);
};

var createBasicHandTab = function(params, cb){
  db.createHandTab(params.channelId, params.table.roundId, function(err, result){
    if(err){
      cb(err);
    } else{
      cb(null, params);
    }
  });
};

var createBasicSummary = function(params,cb){
  async.each(params.table.players,function(player,ecb){
    params.table.summaryOfAllPlayers[player.seatIndex] = "";
    ecb();
  });
  console.log("basic summary",params.table.summaryOfAllPlayers);
  cb(null,params);
};

// ### Adjust active player indexes among each other
// > Set preActiveIndex and nextActiveIndex values for each player
// > Used for turn transfer importantly
var adjustActiveIndexes = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig adjustActiveIndexes');
  adjustIndex.perform(params, function(performResponse) {
    if(performResponse.success) {
      cb(null, params);
    } else {
      cb(performResponse);
    }
  });
};

var twoDeciderPlayer = function(decider) {
  return (_.where(decider, {isPresent: true}).length === 2);
};

var sameDealerAndSmallBlind = function (decider, cb) {
  var smallBlindPresent = _ld.findIndex(decider, {isPresent: true, type: stateOfX.playerType.smallBlind});
  var dealerPresent     = _ld.findIndex(decider, {isPresent: true, type: stateOfX.playerType.dealer});
  if(smallBlindPresent >= 0 && dealerPresent >= 0) {
    cb (decider[smallBlindPresent].playerId === decider[smallBlindPresent].playerId);
  } else {
    cb (false);
  }
};

var getPlayerState = function(table, playerId) {
  if(!!_.where(table.players, {playerId: playerId}) && _.where(table.players, {playerId: playerId}).length > 0) {
    return _.where(table.players, {playerId: playerId})[0].state;
  }
};

var totalSeatOccpuied = function(params, cb) {
  params.data.totalSeatIndexOccupied  = _.pluck(_.where(params.table.players, {state: stateOfX.playerState.playing}), 'seatIndex');
  serverLog(stateOfX.serverLogType.info, 'Seatindex occupied - ' + params.data.totalSeatIndexOccupied);
  cb(null, params);
};

var setFirstDealer = function(params, cb) {
  console.log('Round count for this table - ' + params.table.roundCount);
  if(params.table.roundCount === 1) {
    params.data.delaerFound = true;
    params.data.currentDealerSeatIndex = params.data.totalSeatIndexOccupied[0];
  }
  cb(null, params);
};

var setPreDecideDealer = function(params, cb) {
  if(!params.data.delaerFound) {
    serverLog(stateOfX.serverLogType.info, 'Dealer pre decided seat index for this game - ' + params.table.nextDealerSeatIndex);
    if(params.table.nextDealerSeatIndex >= 1) {
      var thisDealerIndex = _ld.findIndex(params.table.players, {seatIndex: params.table.nextDealerSeatIndex});
      serverLog(stateOfX.serverLogType.info, 'Dealer index in setPreDecideDealer - ' + thisDealerIndex);
      if((thisDealerIndex  < 0 && _.where(params.table.players, {state: stateOfX.playerState.playing}).length > 2) || (thisDealerIndex >= 0 && params.table.players[thisDealerIndex].state === stateOfX.playerState.playing)) {
        params.data.currentDealerSeatIndex = params.table.nextDealerSeatIndex;
        params.data.delaerFound = true;
        cb(null, params);
      } else {
        serverLog(stateOfX.serverLogType.info, 'Player on pre defined DEALER is not in state PLAYING , getting new Dealer.');
        cb(null, params);
      }
    } else {
      cb(null, params);
    }
  } else {
    cb(null, params);
  }
};

var setNewDealer = function(params, cb) {
  if(!params.data.delaerFound) {
    serverLog(stateOfX.serverLogType.info, 'Avoiding dealer player set with state not as PLAYING');
    params.seatIndex = params.table.nextDealerSeatIndex;
    tableManager.nextActiveSeatIndex(params, function(seatIndexResponse){
      serverLog(stateOfX.serverLogType.info, 'Next active seatIndex after current dealer seatIndexResponse => ' + JSON.stringify(seatIndexResponse));
      if(seatIndexResponse.success) {
        params.data.currentDealerSeatIndex = seatIndexResponse.seatIndex;
        params.data.delaerFound = true;
        cb(null, params);
      } else {
        cb(seatIndexResponse);
      }
    });
  } else {
    cb(null, params);
  }
};

var setDealerIndexAndSeatIndex = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig setDealerIndexAndSeatIndex');
  if(params.data.delaerFound) {
    var playerIndexOnTable = _ld.findIndex(params.table.players, {seatIndex: params.data.currentDealerSeatIndex});
    params.table.dealerIndex = playerIndexOnTable;
    params.table.dealerSeatIndex = params.data.currentDealerSeatIndex;
    serverLog(stateOfX.serverLogType.info, 'Dealer index in players - ' + params.table.dealerIndex + '  and seat index - ' + params.table.dealerSeatIndex);
    cb(null, params);
  } else {
    serverLog(stateOfX.serverLogType.error, "No dealer decided for new Game");
    cb({success: false, channelId: params.channelId, info: "Dealer decision failed for new Game"});
  }
};

var setNextGameDealer = function(params, cb) {
  if(_.where(params.table.players, {state: stateOfX.playerState.playing}).length !== 2) {
    params.table.nextDealerSeatIndex = params.table.smallBlindSeatIndex;
    serverLog(stateOfX.serverLogType.info, "More than 2 player case, Seat index of Dealer for next Game - " + params.table.nextDealerSeatIndex);
    cb(null, params);
    return;
  }
  
  params.seatIndex = params.table.dealerSeatIndex;
  tableManager.nextActiveSeatIndex(params, function(seatIndexResponse){
    serverLog(stateOfX.serverLogType.info, 'setNextGameDealerDetails seatIndexResponse => ' + JSON.stringify(seatIndexResponse));
    if(seatIndexResponse.success) {
      params.table.nextDealerSeatIndex = seatIndexResponse.seatIndex;
      serverLog(stateOfX.serverLogType.info, "Seat index of Dealer for next Game - " + params.table.nextDealerSeatIndex);
      cb(null, params);
    } else {
      cb(seatIndexResponse);
    }
  });
};


// Set this game and next game dealer details
var setDealerDetails = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig setDealerDetails');
  serverLog(stateOfX.serverLogType.info, 'About to set SB at seat - ' + params.table.nextSmallBlindSeatIndex);
  async.waterfall([
    async.apply(totalSeatOccpuied, params),
    setFirstDealer,
    setPreDecideDealer,
    setNewDealer,
    setDealerIndexAndSeatIndex,
    // setNextGameDealer
  ], function(err, params){
    cb(err, params);
  });
};

var setFirstSmallBlind = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig setFirstSmallBlind');
  params.data.smallBlindSet = false;
  if(params.table.roundCount === 1) {
    if(_.where(params.table.players, {state: stateOfX.playerState.playing}).length === 2) {
      params.data.smallBlindSet = true;
      params.table.smallBlindSeatIndex = params.table.dealerSeatIndex;
      serverLog(stateOfX.serverLogType.info, '1st SB set at seat for 2 players - ' + params.table.smallBlindSeatIndex);
    } else {
      params.data.smallBlindSet = true;
      params.table.smallBlindSeatIndex  = params.data.totalSeatIndexOccupied[1];
      serverLog(stateOfX.serverLogType.info, '1st SB set at seat - ' + params.table.smallBlindSeatIndex);
    }
  }
  cb(null, params);
};

var setSmallBlindToDealer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig setSmallBlindToDealer');
  if(_.where(params.table.players, {state: stateOfX.playerState.playing}).length === 2) {
    serverLog(stateOfX.serverLogType.info, 'Only 2 playing players so setting dealer as SB.');
    params.data.smallBlindSet        = true;
    params.table.smallBlindSeatIndex = params.table.dealerSeatIndex;
    cb(null, params);
  } else {
    serverLog(stateOfX.serverLogType.info, 'Not a 2 player game, skipping SB setting to Dealer case.');
    cb(null, params);
  }
};

var setPreDecideSmallBlind = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig setPreDecideSmallBlind');
  if(!params.data.smallBlindSet) {
    
    var thisSmallBlindIndex = _ld.findIndex(params.table.players, {seatIndex: params.table.nextSmallBlindSeatIndex});
    serverLog(stateOfX.serverLogType.info, 'SB index in setPreDecideSmallBlind - ' + thisSmallBlindIndex);
    if((thisSmallBlindIndex  < 0 && _.where(params.table.players, {state: stateOfX.playerState.playing}).length > 2) || (thisSmallBlindIndex >= 0 && params.table.players[thisSmallBlindIndex].state === stateOfX.playerState.playing)) {
      params.data.smallBlindSet        = true;
      params.table.smallBlindSeatIndex = params.table.nextSmallBlindSeatIndex;
      cb(null, params);
    } else {
      serverLog(stateOfX.serverLogType.info, 'Player on pre defined SB is not in state PLAYING , getting new SB.');
      params.seatIndex = params.table.nextSmallBlindSeatIndex;
      tableManager.nextActiveSeatIndex(params, function(seatIndexResponse){
        serverLog(stateOfX.serverLogType.info, 'Next seatIndexResponse => ' + JSON.stringify(seatIndexResponse));
        if(seatIndexResponse.success) {
          params.table.smallBlindSeatIndex = seatIndexResponse.seatIndex;
          params.data.smallBlindSet        = true;
          serverLog(stateOfX.serverLogType.info, 'SB set at seat - ' + params.table.smallBlindSeatIndex);
          cb(null, params);
        } else {
          cb(seatIndexResponse);
        }
      });
      cb(null, params);
    }
  } else {
    cb(null, params);
  }
};

var resetSmallBlind = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig resetSmallBlind');
  // serverLog(stateOfX.serverLogType.info, 'Total players length - ' + _.where(params.table.players, {state: stateOfX.playerState.playing}).length > 2);
  var totalPlayers = _.where(params.table.players, {state: stateOfX.playerState.playing}).length;
  if(totalPlayers > 2) {
    serverLog(stateOfX.serverLogType.info, 'Total players while setting SB - ' + totalPlayers);
    if(params.table.dealerSeatIndex == params.table.smallBlindSeatIndex){
      serverLog(stateOfX.serverLogType.info, 'The dealer and SB same when players more than 2, reset SB to next seat - ' + totalPlayers);
      params.seatIndex = params.table.smallBlindSeatIndex;
      tableManager.nextActiveSeatIndex(params, function(seatIndexResponse){
        serverLog(stateOfX.serverLogType.info, 'Next seatIndexResponse => ' + JSON.stringify(seatIndexResponse));
        if(seatIndexResponse.success) {
          params.table.smallBlindSeatIndex = seatIndexResponse.seatIndex;
          params.data.smallBlindSet        = true;
          serverLog(stateOfX.serverLogType.info, 'SB set at seat - ' + params.table.smallBlindSeatIndex);
          cb(null, params);
        } else {
          cb(seatIndexResponse);
        }
      });
    } else {
      cb(null, params);
    }
  } else {
    cb(null, params);
  }
};

var setSmallBlindIndexAndSeatIndex = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig setSmallBlindIndexAndSeatIndex');
  if(params.data.smallBlindSet) {
    var playerIndexOnTable       = _ld.findIndex(params.table.players, {seatIndex: params.table.smallBlindSeatIndex});
    params.table.smallBlindIndex = playerIndexOnTable;
    serverLog(stateOfX.serverLogType.info, 'Small blind index in players array - ' + params.table.smallBlindIndex + '  and seat index - ' + params.table.smallBlindSeatIndex);
    cb(null, params);
  } else {
    serverLog(stateOfX.serverLogType.error, "Small blind decision failed !");
    cb({success: false, channelId: params.channelId, info: "Small blind decision failed !"});
  }
};

var setNextGameSmallBlind = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig setNextGameSmallBlind');
  params.seatIndex = params.table.smallBlindSeatIndex;
  if(_.where(params.table.players, {state: stateOfX.playerState.playing}).length === 2) {
    params.table.nextSmallBlindSeatIndex = params.table.nextDealerSeatIndex;
    serverLog(stateOfX.serverLogType.info, '2 player case, next game SB set at seat - ' + params.table.smallBlindSeatIndex);
    cb(null, params);
  } else {
    tableManager.nextActiveSeatIndex(params, function(seatIndexResponse){
      serverLog(stateOfX.serverLogType.info, 'Getting seat while setting next Game SB seatIndexResponse = ' + JSON.stringify(seatIndexResponse));
      if(seatIndexResponse.success) {
        params.table.nextSmallBlindSeatIndex = seatIndexResponse.seatIndex;
        serverLog(stateOfX.serverLogType.info, 'More than 2 player case, next game SB set at seat - ' + params.table.nextSmallBlindSeatIndex);
        cb(null, params);
      } else {
        cb(seatIndexResponse);
      }
    });
  }
};

var setSmallBlindDetails = function(params, cb) {
  async.waterfall([
    async.apply(setFirstSmallBlind, params),
    setSmallBlindToDealer,
    setPreDecideSmallBlind,
    resetSmallBlind,
    setSmallBlindIndexAndSeatIndex,
    setNextGameDealer,
    setNextGameSmallBlind
  ], function(err, params){
    cb(err, params);
  });
};

var setBigBlindDetails = function(params, cb) {
  params.table.bigBlindIndex     = _ld.findIndex(params.table.players, {seatIndex: params.table.nextSmallBlindSeatIndex});
  params.table.bigBlindSeatIndex = params.table.players[params.table.bigBlindIndex].seatIndex;
  serverLog(stateOfX.serverLogType.info, 'Big blind players details - ' + JSON.stringify(params.table.bigBlindIndex));
  cb(null, params);
};

var setFirstPlayerDetails = function(params, cb) {
  if(_.where(params.table.players, {state: stateOfX.playerState.playing}).length === 2) {
    serverLog(stateOfX.serverLogType.info, 'This is two player game so, first player setting to BB.');
    params.table.firstActiveIndex = params.table.bigBlindIndex;
    cb(null, params);
  } else {
    serverLog(stateOfX.serverLogType.info, 'This is not a two player game so first player setting to SB.');
    params.table.firstActiveIndex = params.table.smallBlindIndex;
    cb(null, params);
  }
};

// Set straddle player on table
var setStraddlePlayer = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig setStraddlePlayer');
  keyValidator.validateKeySets("Request", "database", "setStraddlePlayer", params, function (validated){
    if(validated.success) {

      // Check if this is not a two player game
      if(_.where(params.table.players, {state: stateOfX.playerState.playing}).length <= 2) {
        serverLog(stateOfX.serverLogType.info, 'There are only two playing players so resetting straddle index to -1.');
        params.table.straddleIndex = -1;
        cb(null, params);
        return;
      }

      if(params.table.isStraddleEnable) {
        serverLog(stateOfX.serverLogType.info, 'This table is straddle enabled, checking if two player game or not.');
        serverLog(stateOfX.serverLogType.info, 'There are more than 2 playing players so about to set straddle player details.');
        params.table.straddleIndex = params.table.players[params.table.bigBlindIndex].nextActiveIndex;
        serverLog(stateOfX.serverLogType.info, 'New straddle index set next to dealer -  ' + params.table.straddleIndex + '.');
        cb(null, params);
    	} else {
        serverLog(stateOfX.serverLogType.info, 'This table is not a straddle enabled check if relavent player enabled to become straddle.');
        serverLog(stateOfX.serverLogType.info, 'Player length - ' + params.table.players.length + ' next to BB index - ' + tableManager.getNextSuitableIndex(params.table.bigBlindIndex, params.table.players.length));
        serverLog(stateOfX.serverLogType.info, 'Player next to BB - ' + JSON.stringify(params.table.players[tableManager.getNextSuitableIndex(params.table.bigBlindIndex, params.table.players.length)]));

        if(params.table.players[tableManager.getNextSuitableIndex(params.table.bigBlindIndex, params.table.players.length)].isStraddleOpted) {
          serverLog(stateOfX.serverLogType.info, 'Setting next to BB player as straddle');
          params.table.straddleIndex = tableManager.getNextSuitableIndex(params.table.bigBlindIndex, params.table.players.length);
        } else {
          serverLog(stateOfX.serverLogType.info, 'Not setting next to BB player as straddle');
          params.table.straddleIndex = -1;
        }
    		cb(null, params);
    	}
    } else {
      cb(validated);
    }
  });
};

// ### Set current player 
var setCurrentPlayer = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig setCurrentPlayer');
  keyValidator.validateKeySets("Request", "database", "setCurrentPlayer", params, function (validated){
    if(validated.success) {
      if(params.table.straddleIndex >= 0) {
        serverLog(stateOfX.serverLogType.info, 'Straddle is already set for this game so setting current player move next to straddle.');
        params.table.currentMoveIndex = params.table.players[params.table.straddleIndex].nextActiveIndex;
        params.table.turnTimeStartAt = new Date().getTime();
        cb(null, params);
      } else {
        serverLog(stateOfX.serverLogType.info, 'This is not a straddle game so setting current player move next to BB.');
        serverLog(stateOfX.serverLogType.info, 'BB player details - ' + JSON.stringify(params.table.players[params.table.bigBlindIndex]));
        params.table.currentMoveIndex = params.table.players[params.table.bigBlindIndex].nextActiveIndex;
        params.table.turnTimeStartAt = new Date().getTime();
        cb(null, params);
      }
    } else {
      cb(validated);
    }
  });
};

// ### Increment blind missed played count for player
// > If the previous player from big blind is on break (sitout) only

var incrementBlindMissedPlayed = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig incrementBlindMissedPlayed');
  keyValidator.validateKeySets("Request", "database", "incrementBlindMissedPlayed", params, function (validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.info, 'Players while incrementing bigblind missed for sitout players - ' + JSON.stringify(params.table.players));
      serverLog(stateOfX.serverLogType.info, 'Current BB index - ' + params.table.bigBlindIndex);
      var previousToBigBlindIndex = tableManager.getPreSuitableIndex(params.table.bigBlindIndex, params.table.players.length);
      serverLog(stateOfX.serverLogType.info, 'Previous index to BB, player - ' + JSON.stringify(params.table.players[previousToBigBlindIndex]));
      if(params.table.players[previousToBigBlindIndex].state === stateOfX.playerState.onBreak) {
        serverLog(stateOfX.serverLogType.info, 'Player at index previous to BB is ' + params.table.players[previousToBigBlindIndex].state + ', incrementing BB missed.');
        params.table.players[previousToBigBlindIndex].bigBlindMissed = params.table.players[previousToBigBlindIndex].bigBlindMissed + 1;
      } else {
        serverLog(stateOfX.serverLogType.info, 'Player at index previous to BB is ' + params.table.players[previousToBigBlindIndex].state + ', resetting BB missed to 0.');
        params.table.players[previousToBigBlindIndex].bigBlindMissed = 0;
      }
      serverLog(stateOfX.serverLogType.info, 'Total Big Blind missed for player - ' + params.table.players[previousToBigBlindIndex].playerName + ' - ' + params.table.players[previousToBigBlindIndex].bigBlindMissed);
      cb(null, params);
    } else {
      cb({success: false, channelId: params.channelId, info: "Increment big blind count fail ! - " + JSON.stringify(validated)});
    }
  });
};

var initializeParams = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig initializeParams');
  params.data                        = {};
  params.data.activePlayers          = [];
  params.data.delaerFound            = false;
  params.data.currentDealerSeatIndex = -1;
  cb(null, params);
};

setTableConfig.setConfig = function(params,cb){
  console.log(params.table.players);
  async.waterfall([

    async.apply(initializeParams, params),
    updateTableEntitiesOnGameStart,
    createBasicHandTab,
    createBasicSummary,
    adjustActiveIndexes,
    setDealerDetails,
    setSmallBlindDetails,
    setBigBlindDetails,
    incrementBlindMissedPlayed,
    setStraddlePlayer,
    setFirstPlayerDetails,
    setCurrentPlayer
  ], function (err, response){
    if(err){
      cb(err);
    } else{
      serverLog(stateOfX.serverLogType.info, 'Dealer table-players index - ' + params.table.dealerIndex + ' and seat index - ' + params.table.dealerSeatIndex);
      serverLog(stateOfX.serverLogType.info, 'SB table-players index - ' + params.table.smallBlindIndex + ' and seat index - ' + params.table.smallBlindSeatIndex);
      serverLog(stateOfX.serverLogType.info, 'BB table-players index - ' + params.table.bigBlindIndex + ' and seat index - ' + params.table.bigBlindSeatIndex);
      serverLog(stateOfX.serverLogType.info, 'Next Dealer -1 and ' + params.table.nextDealerSeatIndex);
      serverLog(stateOfX.serverLogType.info, 'Next SB -1 and ' + params.table.nextSmallBlindSeatIndex);
      // tableConfigManager.nextGameConfig(params, function(getNextDealerSeatIndexResponse){
      //   serverLog(stateOfX.serverLogType.info, 'getNextDealerSeatIndexResponse - ' + JSON.stringify(getNextDealerSeatIndexResponse));
      // });
      cb({success: true, table: params.table, data: params.data});
    }
  });
};
     
module.exports = setTableConfig;