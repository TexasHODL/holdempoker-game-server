/*jshint node: true */
"use strict";

var async              = require("async"),
    _ld                = require("lodash"),
    _                  = require("underscore"),
    adjustIndex        = require("./adjustActiveIndex"),
    tableManager       = require("./tableManager"),
    stateOfX           = require("../../../../shared/stateOfX"),
    activity           = require("../../../../shared/activity"),
    keyValidator       = require("../../../../shared/keysDictionary"),
    zmqPublish         = require("../../../../shared/infoPublisher"),
    db                 = require("../../../../shared/model/dbQuery"),
    logDB              = require("../../../../shared/model/logDbQuery.js"),
    tableConfigManager = require("./tableConfigManager"),
    popupTextManager   = require("../../../../shared/popupTextManager"),
    setTableConfig     = {};
const configConstants = require('../../../../shared/configConstants');
// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'setTableConfig';
  logObject.serverName   = stateOfX.serverType.database;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### Set Game state as Running
// > Game state, Occupied seat count, Vacant seat count and Round Id
var updateTableEntitiesOnGameStart = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig updateTableEntitiesOnGameStart');
  params.table.state                 = stateOfX.gameState.running;
  params.table.stateInternal         = stateOfX.gameState.running;
  params.table.pot                   = [];
  params.table.occupiedSeats         = params.table.players.length;
  params.table.vacantSeats           = params.table.maxPlayers - params.table.players.length;
  params.table.onStartPlayers        = _.pluck(_.where(params.table.players, {state: stateOfX.playerState.playing}), 'playerId');
  params.table.summaryOfAllPlayers   = {};
  params.table.handHistory           = [];

  // Reset roundId for playing players in this game
  _.map(_.where(params.table.players, {state: stateOfX.playerState.playing}), function(player){
    player.roundId = params.table.roundId;
    player.hasPlayedOnceOnTable = true;
    player.lastRoundPlayed = stateOfX.round.preflop;
    // Set selected precheck as NONE for every player at game start - so that old value from previous game
    // not be there to perform moves
    player.precheckValue = stateOfX.playerPrecheckValue.NONE;
    // save player chips in onGameStartBuyIn - to show on dashboard
    player.onGameStartBuyIn = player.chips;
    player.totalGames = (player.totalGames || 0) + 1;
    if ((player.totalGames % configConstants.timebank.earnAfterEveryManyHands) === 0) { // 50 hands
      player.timeBankSec = (player.timeBankSec || 0) + configConstants.timebank.earnSec; // time bank earned // + 10 sec
      if (player.timeBankSec > configConstants.timebank.maxSeconds) { // max 30 sec
        player.timeBankSec = configConstants.timebank.maxSeconds;
      }
    }
    return player;
  });

  // activity.startGameInfo(params,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.startGame,stateOfX.logType.info);
  cb(null, params);
};

// create record for hand tab
var createBasicHandTab = function(params, cb){
  console.log(JSON.stringify(params.table.players));
  logDB.createHandTab(params.channelId, params.table.roundId, params.table.roundNumber, function(err, result){
    if(err){
      serverLog(stateOfX.serverLogType.error, "Unable to store initiated hand hostory record for this table! - " + JSON.stringify(err));
      cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.dbQyeryInfo.DBCREATEHANDTAB_FAIL_SETTABLECONFIG + JSON.stringify(err)});
      //cb({success: false, channelId: params.channelId, info: "Unable to store initiated hand hostory record for this table! - " + JSON.stringify(err)})
    } else{
      cb(null, params);
    }
  });
};

// init summary text for all players
var createBasicSummary = function(params,cb){
  async.each(_.where(params.table.players, {state: stateOfX.playerState.playing}),function(player,ecb){
    params.table.summaryOfAllPlayers[player.seatIndex] = "";
    ecb();
  }, function(err){
    if(err) {
      serverLog(stateOfX.serverLogType.error, "Unable to initiate summary for this game! - " + JSON.stringify(err));
      cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.CREATEBASICSUMMARY_FAIL_SETTABLECONFIG + JSON.stringify(err)});

      //cb({success: false, channelId: params.channelId, info: "Unable to initiate summary for this game! - " + JSON.stringify(err)})
    } else {
      serverLog(stateOfX.serverLogType.info, "Summary for this game initiated with - " + JSON.stringify(params.table.summaryOfAllPlayers));
      cb(null, params);
    }
  });
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

// save array of seat indexes occupied by players
var totalSeatOccpuied = function(params, cb) {
  params.data.totalSeatIndexOccupied  = _.pluck(_.where(params.table.players, {state: stateOfX.playerState.playing}), 'seatIndex');
  serverLog(stateOfX.serverLogType.info, 'Seatindex occupied - ' + params.data.totalSeatIndexOccupied);
  cb(null, params);
};

// set first time dealer
// first?: when inmemory table got created and first game started
var setFirstDealer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Round count for this table - ' + params.table.roundCount);
  if(params.table.roundCount === 1) {
    params.data.delaerFound            = true;
    params.data.currentDealerSeatIndex = params.data.totalSeatIndexOccupied[0];
  }
  cb(null, params);
};

// check if already decided dealer can be set
// by checking his availability conditions
// and by smallblind and bigblind positions
var setPreDecideDealer = function(params, cb) {
  if(!params.data.delaerFound) {
    serverLog(stateOfX.serverLogType.info, 'Dealer pre decided seat index for this game - ' + params.table.nextDealerSeatIndex);
    if(params.table.nextDealerSeatIndex >= 1) {
      var thisDealerSeatIndex = _ld.findIndex(params.table.players, {seatIndex: params.table.nextDealerSeatIndex});
      serverLog(stateOfX.serverLogType.info, 'Dealer seat index in setPreDecideDealer - ' + thisDealerSeatIndex);
      var shouldSetPreDecidedDealer = false;

      // If DEALER of SB player left then player next to Dealer will become new Dealer
      // in order to prevent same SB and BB for this game as in previous one
      var previousDealerIndexInPlayers     = _ld.findIndex(params.table.players, {seatIndex: params.table.dealerSeatIndex});
      serverLog(stateOfX.serverLogType.info, 'Delaer player left if value is less than 0 => ' + previousDealerIndexInPlayers);
      var previousSmallBlindIndexInPlayers = _ld.findIndex(params.table.players, {seatIndex: params.table.smallBlindSeatIndex});
      serverLog(stateOfX.serverLogType.info, 'SB player left if value is less than 0 => ' + previousSmallBlindIndexInPlayers);

      params.data.dealerLeft             = previousDealerIndexInPlayers < 0;
      params.data.smallBlindLeft         = previousSmallBlindIndexInPlayers < 0;
      params.data.dealerOrSmallBlindLeft = previousDealerIndexInPlayers < 0 || previousSmallBlindIndexInPlayers < 0;
      params.data.sameDealerSmallBlind   = params.table.dealerSeatIndex === params.table.smallBlindSeatIndex;

      serverLog(stateOfX.serverLogType.info, 'Dealer or Small Blind player left - ' + params.data.dealerOrSmallBlindLeft);
      serverLog(stateOfX.serverLogType.info, 'Dealer player left - ' + params.data.dealerLeft);
      serverLog(stateOfX.serverLogType.info, 'Small Blind player left - ' + params.data.smallBlindLeft);

      // Dead dealer case: At least 3 players are there and the next Dealer left the game
      shouldSetPreDecidedDealer = thisDealerSeatIndex  < 0 && _.where(params.table.players, {state: stateOfX.playerState.playing}).length > 2;
      serverLog(stateOfX.serverLogType.info, 'Dealer should decide from pre decided - ' + shouldSetPreDecidedDealer);

      // Next dealer seat is occupied and player is in playing mode
      if(!shouldSetPreDecidedDealer) {
        shouldSetPreDecidedDealer = thisDealerSeatIndex >= 0 && params.table.players[thisDealerSeatIndex].state === stateOfX.playerState.playing;
        serverLog(stateOfX.serverLogType.info, 'Updated Dealer should decide from pre decided - ' + shouldSetPreDecidedDealer);
      }

      // Heads-up Play: Dealer eliminated
      if(shouldSetPreDecidedDealer) {
        shouldSetPreDecidedDealer = !(params.data.dealerLeft && _.where(params.table.players, {state: stateOfX.playerState.playing}).length === 2);
        serverLog(stateOfX.serverLogType.info, 'Heads-up Play: Dealer eliminated => Updated Dealer should decide from pre decided - ' + shouldSetPreDecidedDealer);
      }

      if(((params.data.sameDealerSmallBlind && params.data.dealerLeft) || shouldSetPreDecidedDealer)) {
        params.data.currentDealerSeatIndex = params.table.nextDealerSeatIndex;
        params.data.delaerFound            = true;
        cb(null, params);
      } else {
        serverLog(stateOfX.serverLogType.info, 'Dealer is not setting from pre-decided one, will get new dealer in next step.');
        cb(null, params);
      }
    } else {
      cb(null, params);
    }
  } else {
    cb(null, params);
  }
};

// set dealer who is active next to seat which was supposed to be dealer in this game acc to set in prev game
var setNewDealer = function(params, cb) {
  if(!params.data.delaerFound) {
    serverLog(stateOfX.serverLogType.info, 'Getting a new Dealer for this Game, next to pre decided dealer.');
    params.seatIndex = params.table.nextDealerSeatIndex;
    tableManager.nextActiveSeatIndex(params, function(seatIndexResponse){
      serverLog(stateOfX.serverLogType.info, 'Next active seatIndex after current dealer seatIndexResponse => ' + JSON.stringify(seatIndexResponse));
      if(seatIndexResponse.success) {
        params.data.currentDealerSeatIndex = seatIndexResponse.seatIndex;
        params.data.delaerFound            = true;
        cb(null, params);
      } else {
        cb(seatIndexResponse);
      }
    });
  } else {
    cb(null, params);
  }
};

// set finally dealer array index and seat index
var setDealerIndexAndSeatIndex = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig setDealerIndexAndSeatIndex');
  if(params.data.delaerFound) {
    var playerIndexOnTable = _ld.findIndex(params.table.players, {seatIndex: params.data.currentDealerSeatIndex});
    params.table.dealerIndex     = playerIndexOnTable;
    params.table.dealerSeatIndex = params.data.currentDealerSeatIndex;
    serverLog(stateOfX.serverLogType.info, 'Dealer index in players - ' + params.table.dealerIndex + '  and seat index - ' + params.table.dealerSeatIndex);
    cb(null, params);
  } else {
    serverLog(stateOfX.serverLogType.error, "No dealer decided for new Game");
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SETDEALERINDEXANDSEATINDEX_FAIL_SETTABLECONFIG});

    //cb({success: false, channelId: params.channelId, info: "Dealer decision failed for new Game"});
  }
};

// set dealer for next game
// normal rules
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
  async.waterfall([
    async.apply(totalSeatOccpuied, params),
    setFirstDealer,
    setPreDecideDealer,
    setNewDealer,
    setDealerIndexAndSeatIndex,
  ], function(err, params){
    cb(err, params);
  });
};

// set first (when table created) small blind
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

// set small blind normal rule
// next to dealer
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

// set already decided small blind
// check some conditions
// acc to availability
var setPreDecideSmallBlind = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig setPreDecideSmallBlind');
  if(!params.data.smallBlindSet) {

    var thisSmallBlindIndex = _ld.findIndex(params.table.players, {seatIndex: params.table.nextSmallBlindSeatIndex});
    serverLog(stateOfX.serverLogType.info, 'SB index in players setPreDecideSmallBlind - ' + thisSmallBlindIndex);

    serverLog(stateOfX.serverLogType.info, 'Delaer player left - ' + params.data.dealerLeft);

    // Modifying dealer left case as case fails when SB&BB left
    // next game dead SB deduct
    // In next game and further assigning wrong SB players

    if((!params.data.sameDealerSmallBlind && parseInt(thisSmallBlindIndex) >= 0) || (!params.data.dealerLeft && params.data.sameDealerSmallBlind) || (parseInt(thisSmallBlindIndex) < 0 && _.where(params.table.players, {state: stateOfX.playerState.playing}).length > 2) || (thisSmallBlindIndex >= 0 && params.table.players[thisSmallBlindIndex].state === stateOfX.playerState.playing && !params.data.dealerLeft)) {
      if(thisSmallBlindIndex >= 0 && params.table.players[thisSmallBlindIndex].state === stateOfX.playerState.playing) {
        serverLog(stateOfX.serverLogType.info, 'Small blind set finally from pre decided player!');
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
      }
    } else {
      serverLog(stateOfX.serverLogType.info, 'Not setting SB as pre decided as some condition fails.');
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
      // cb(null, params);
    }
  } else {
    cb(null, params);
  }
};

// set small blind as a new one
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

// set finally small blind array index and seat index
var setSmallBlindIndexAndSeatIndex = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig setSmallBlindIndexAndSeatIndex');
  if(params.data.smallBlindSet) {
    var playerIndexOnTable       = _ld.findIndex(params.table.players, {seatIndex: params.table.smallBlindSeatIndex});
    params.table.smallBlindIndex = playerIndexOnTable;
    serverLog(stateOfX.serverLogType.info, 'Small blind index in players array - ' + params.table.smallBlindIndex + '  and seat index - ' + params.table.smallBlindSeatIndex);
    cb(null, params);
  } else {
    serverLog(stateOfX.serverLogType.error, "Small blind decision failed !");
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SETSMALLBLINDINDEXANDSEATINDEX_FAIL_SETTABLECONFIG});

    //cb({success: false, channelId: params.channelId, info: "Small blind decision failed !"});
  }
};

// set small blind for next game
// normal rules
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

// Set this game and next game small blind details
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

// Set game big blind details
var setBigBlindDetails = function(params, cb) {
  params.table.bigBlindIndex     = _ld.findIndex(params.table.players, {seatIndex: params.table.nextSmallBlindSeatIndex});
  params.table.bigBlindSeatIndex = params.table.players[params.table.bigBlindIndex].seatIndex;
  serverLog(stateOfX.serverLogType.info, 'Big blind players details - ' + JSON.stringify(params.table.players[params.table.bigBlindIndex]));
  cb(null, params);
};

// Set game first player details
// who will get first turn in FLOP, TURN, RIVER rounds
var setFirstPlayerDetails = function(params, cb) {
  if(_.where(params.table.players, {state: stateOfX.playerState.playing}).length === 2) {
    serverLog(stateOfX.serverLogType.info, 'This is two player game so, first player setting to BB.');
    params.table.firstActiveIndex = params.table.bigBlindIndex;
    serverLog(stateOfX.serverLogType.info, 'First player details - ' + JSON.stringify(params.table.players[params.table.firstActiveIndex]));
    cb(null, params);
  } else {
    serverLog(stateOfX.serverLogType.info, 'This is not a two player game so first player setting next to Dealer.');
    serverLog(stateOfX.serverLogType.info, 'Dealer index in players - ' + params.table.dealerIndex);
    serverLog(stateOfX.serverLogType.info, 'Dealer player details, if undefined then Dead delaer case - ' + JSON.stringify(params.table.players[params.table.dealerIndex]));
    serverLog(stateOfX.serverLogType.info, 'Player next to delaer is at seat index - ' + tableManager.getNextActivePlayerBySeatIndex({table: params.table, seatIndex: params.table.dealerSeatIndex}));
    params.table.firstActiveIndex = _ld.findIndex(params.table.players, {seatIndex: tableManager.getNextActivePlayerBySeatIndex({table: params.table, seatIndex: params.table.dealerSeatIndex})});
    serverLog(stateOfX.serverLogType.info, 'First player details - ' + JSON.stringify(params.table.players[params.table.firstActiveIndex]));
    cb(null, params);
  }
};

// Set straddle player on table
var setStraddlePlayer = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig setStraddlePlayer');
  keyValidator.validateKeySets("Request", "database", "setStraddlePlayer", params, function (validated){
    if(validated.success) {

      // Check if condition for min players required for players fulfilled
      if(_.where(params.table.players, {state: stateOfX.playerState.playing}).length <= parseInt(configConstants.minPlayersForStraddle)) {
        serverLog(stateOfX.serverLogType.info, 'There are less than ' + parseInt(configConstants.minPlayersForStraddle) + ' playing players so resetting straddle index to -1.');
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
        serverLog(stateOfX.serverLogType.info, 'Player length - ' + params.table.players.length + ' next to BB index - ' + params.table.players[params.table.bigBlindIndex].nextActiveIndex);
        serverLog(stateOfX.serverLogType.info, 'Player next to BB while setting straddle player - ' + JSON.stringify(params.table.players[params.table.players[params.table.bigBlindIndex].nextActiveIndex]));

        if(params.table.players[params.table.players[params.table.bigBlindIndex].nextActiveIndex].isStraddleOpted) {
          serverLog(stateOfX.serverLogType.info, 'Setting next to BB player as straddle');
          params.table.straddleIndex = params.table.players[params.table.bigBlindIndex].nextActiveIndex;
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

// Set current player and turn time start at
// who will get turn now (on game start)
var setCurrentPlayer = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig setCurrentPlayer');
  keyValidator.validateKeySets("Request", "database", "setCurrentPlayer", params, function (validated){
    if(validated.success) {
      if(params.table.straddleIndex >= 0) {
        serverLog(stateOfX.serverLogType.info, 'Straddle is already set for this game so setting current player move next to straddle.');
        params.table.currentMoveIndex = params.table.players[params.table.straddleIndex].nextActiveIndex;
        params.table.turnTimeStartAt = Number(new Date());
        cb(null, params);
      } else {
        serverLog(stateOfX.serverLogType.info, 'This is not a straddle game so setting current player move next to BB.');
        serverLog(stateOfX.serverLogType.info, 'BB player details - ' + JSON.stringify(params.table.players[params.table.bigBlindIndex]));
        params.table.currentMoveIndex = params.table.players[params.table.bigBlindIndex].nextActiveIndex;
        params.table.turnTimeStartAt = Number(new Date());
        cb(null, params);
      }
    } else {
      cb(validated);
    }
  });
};

// Validate if the table entities set properly to start this game
var validateTableAttribToStartGame = function(params, cb) {
  tableManager.validateEntities(params, function(err, response) {
    serverLog(stateOfX.serverLogType.error, 'Error while checking table config on setting config - ' + JSON.stringify(err));
    if(!err) {
      cb(null, params);
    } else {
      cb(err);
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
      serverLog(stateOfX.serverLogType.info, 'Current BB seat index - ' + params.table.bigBlindSeatIndex);
      serverLog(stateOfX.serverLogType.info, 'Current BB Player - ' + JSON.stringify(params.table.players[params.table.bigBlindIndex]));

      serverLog(stateOfX.serverLogType.info, 'Players to check: ' + JSON.stringify(_.pluck(params.table.players, 'playerName')));

      // var previousToBigBlindIndex = tableManager.getPreviousOccupiedSeatIndex({seatIndex: params.table.bigBlindSeatIndex, table: params.table});
      // serverLog(stateOfX.serverLogType.info, 'Seat Index to previous BB player - ' + previousToBigBlindIndex);
      // var indexOfPreBBINPlayers = _ld.findIndex(params.table.players, {seatIndex: parseInt(previousToBigBlindIndex)});

      // Get all sitout indexes from BB to previous PLAYING player
      // and increment BB missed for all these players
      var index = params.table.bigBlindIndex-1 < 0 ? params.table.players.length-1 : params.table.bigBlindIndex-1;
      var players = {};
      for(var i=0; i<params.table.players.length; i++) {
        var player = params.table.players[index];
        serverLog(stateOfX.serverLogType.info, 'Processing player to increment BB missed: ' + JSON.stringify(player.playerName));
        serverLog(stateOfX.serverLogType.info, player.playerName + ' state for incrementing BB missed: ' + player.state);
        if(player.state === stateOfX.playerState.onBreak) {
          serverLog(stateOfX.serverLogType.info, player.playerName + ' previous BB missed value: ' + player.bigBlindMissed);
          player.bigBlindMissed = player.bigBlindMissed + 1;
          serverLog(stateOfX.serverLogType.info, player.playerName + ' updated BB missed value: ' + player.bigBlindMissed);
        } else if (player.state === stateOfX.playerState.playing) { // only stop WHEN last player is PLAYING
          serverLog(stateOfX.serverLogType.info, 'Stopping BB increment check!');
          break;
        }
        index--;
        if(index < 0) {
          index = params.table.players.length-1;
        }
      }

      // if(indexOfPreBBINPlayers >= 0) {
      //   serverLog(stateOfX.serverLogType.info, 'Previous to BB, player - ' + JSON.stringify(params.table.players[indexOfPreBBINPlayers]));
        
      //   // serverLog(stateOfX.serverLogType.info, 'Response from getting previous seat index - ' + JSON.stringify(getPrePlayerBySeatIndexResponse));
      //   if(params.table.players[indexOfPreBBINPlayers].state === stateOfX.playerState.onBreak) {
      //     serverLog(stateOfX.serverLogType.info, 'Player at index previous to BB is ' + params.table.players[indexOfPreBBINPlayers].state + ', incrementing BB missed.');
      //     params.table.players[indexOfPreBBINPlayers].bigBlindMissed = parseInt(params.table.players[indexOfPreBBINPlayers].bigBlindMissed) + 1;
      //   } else {
      //     serverLog(stateOfX.serverLogType.info, 'Player at index previous to BB is ' + params.table.players[indexOfPreBBINPlayers].state + ', resetting BB missed to 0.');
      //     params.table.players[indexOfPreBBINPlayers].bigBlindMissed = 0;
      //   }
      //   serverLog(stateOfX.serverLogType.info, 'Total Big Blind missed for player - ' + params.table.players[indexOfPreBBINPlayers].playerName + ' - ' + params.table.players[indexOfPreBBINPlayers].bigBlindMissed);
      // } else {
      //   serverLog(stateOfX.serverLogType.info, 'Invalid indexes to process BB missed player !' );
      // }
      cb(null, params);

    } else {
      cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.INCREMENTBLINDMISSED_FAIL_SETTABLECONFIG + JSON.stringify(validated)});
      //cb({success: false, channelId: params.channelId, info: "Increment big blind count fail ! - " + JSON.stringify(validated)});
    }
  });
};

// initialize params as false or -1
var initializeParams = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in setTableConfig initializeParams');
  params.data                        = {};
  params.data.activePlayers          = [];
  params.data.delaerFound            = false;
  params.data.currentDealerSeatIndex = -1;
  params.data.dealerOrSmallBlindLeft = false;
  params.data.smallBlindLeft         = false;
  params.data.dealerLeft             = false;
  params.data.sameDealerSmallBlind   = false;
  cb(null, params);
};

// set dealer, sb, bb, opening player, current turn player
setTableConfig.setConfig = function(params,cb){
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
    setCurrentPlayer,
    validateTableAttribToStartGame

  ], function (err, response){
    if(err){
      serverLog(stateOfX.serverLogType.info, 'Error while setting table config - ' + JSON.stringify(err));
      // activity.info(err,stateOfX.profile.category.game,stateOfX.game.subCategory.info,stateOfX.logType.error);
      // activity.info(err,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.info,stateOfX.logType.error);
      cb(err);
    } else{
      serverLog(stateOfX.serverLogType.info, 'Dealer table-players index - ' + params.table.dealerIndex + ' and seat index - ' + params.table.dealerSeatIndex);
      serverLog(stateOfX.serverLogType.info, 'SB table-players index - ' + params.table.smallBlindIndex + ' and seat index - ' + params.table.smallBlindSeatIndex);
      serverLog(stateOfX.serverLogType.info, 'BB table-players index - ' + params.table.bigBlindIndex + ' and seat index - ' + params.table.bigBlindSeatIndex);
      serverLog(stateOfX.serverLogType.info, 'Next Dealer -1 and ' + params.table.nextDealerSeatIndex);
      serverLog(stateOfX.serverLogType.info, 'Next SB -1 and ' + params.table.nextSmallBlindSeatIndex);
      // activity.info(params,stateOfX.profile.category.game,stateOfX.game.subCategory.info,stateOfX.logType.info);
      // activity.info(params,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.info,stateOfX.logType.info);
      cb({success: true, table: params.table, data: params.data});
    }
  });
};

module.exports = setTableConfig;
