/*jshint node: true */
"use strict";

/* Created by Amrendra 09/11/2016 */
/* Handle requests from tableConfigManager file for deciding Dealer, SB and BB players */

var async               = require("async"),
    _ld                = require("lodash"),
    _                  = require("underscore"),
    uuid               = require("uuid"),
    adjustIndex        = require("./adjustActiveIndex"),
    tableManager       = require("./tableManager"),
    stateOfX           = require("../../../../shared/stateOfX"),
    keyValidator       = require("../../../../shared/keysDictionary"),
    zmqPublish         = require("../../../../shared/infoPublisher"),
    popupTextManager  = require("../../../../shared/popupTextManager"),
    db                 = require("../../../../shared/model/dbQuery"),
    tableConfigManager = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'tableConfigManager';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  // zmqPublish.sendLogMessage(logObject);
}

// THIS FILE DOES NOT SET THESE THINGS ACTUALLY
// It does them and revert them back
// reason - To find players who will be part of game or not
// WHY SUCH REASON - becoz player sitting in between dealer and SB may not become part of game

// many functions are similar to setTableConfig.js


// ************* DEALER INDEX DECISION BEGINS HERE **************

// set all ready players as playing
// some of them might again become waiting
var setPlayersAsPlaying = function(params, cb) {
  var waitingPlayers = _.where(params.table.players, {state: stateOfX.playerState.waiting});
  serverLog(stateOfX.serverLogType.info, 'Total waiting players for new round - ' + _.pluck(waitingPlayers, 'playerName'));

  var indexBetweenSBandBB = tableManager.indexBetweenSBandBB(params);
   var stateBetweenSBandBB = tableManager.stateOfSBandBB(params);
  serverLog(stateOfX.serverLogType.info, 'Indexes between SB and BB - ' + indexBetweenSBandBB);

  async.each(waitingPlayers, function(player, ecb){
    serverLog(stateOfX.serverLogType.info, 'Considering player ' + JSON.stringify(player));
    if(indexBetweenSBandBB.indexOf(player.seatIndex) < 0 || params.table.players.length === 3 || stateBetweenSBandBB) {
      player.state = stateOfX.playerState.playing;
      ecb();
    } else{
      serverLog(stateOfX.serverLogType.info, 'Player sitted in between smallblind and bigblind, skipping player!');
      ecb();
    }
  }, function(err){
    if(err) {
      serverLog(stateOfX.serverLogType.info, 'Player refresh failed !');
      cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SETPLAYERSASPLAYINGFAIL_TABLECONFIGMANAGER});
      //cb({success: false, channelId: params.channelId, info: "Player consider and skip failed !"})
    } else {
      cb(null, params);
    }
  });
};

// sort player indexes acc to state
// put playing first
var sortPlayerIndexes = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in function sortPlayerIndexes');
  serverLog(stateOfX.serverLogType.info, 'players before sort based on seat - ' + JSON.stringify(params.table.players));
  // serverLog(stateOfX.serverLogType.info, 'Current dealer index - ' + params.table.dealerIndex);
  params.table.players.sort(function(a, b) { return parseInt(a.seatIndex) - parseInt(b.seatIndex); });
  // serverLog(stateOfX.serverLogType.info, 'players after sort based on seat - ' + JSON.stringify(params.table.players));
  var playingPlayers = [];
  var inactivePlayer = [];
  async.each(params.table.players, function(player, ecb){

    serverLog(stateOfX.serverLogType.info, 'Sorting player - ' + JSON.stringify(player));

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
      cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""),info: popupTextManager.falseMessages.SORTPLAYERINDEXESFAIL_TABLECONFIGMANAGER});
      //cb({success: false, channelId: channelId, info: "Sorting players on game start failed."})
    } else {
      params.table.players = playingPlayers.concat(inactivePlayer); // Directly store sorted players into table players array
      serverLog(stateOfX.serverLogType.info, 'Final sorted players - ' + JSON.stringify(params.table.players));
      cb(null, params);
    }
  });
};

// find out array of seat occupied
var totalSeatOccpuied = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in function totalSeatOccpuied');
  params.data.totalSeatIndexOccupied  = _.pluck(_.where(params.table.players, {state: stateOfX.playerState.playing}), 'seatIndex');
  serverLog(stateOfX.serverLogType.info, 'Seatindex occupied - ' + params.data.totalSeatIndexOccupied);
  cb(null, params);
};

// set dealer as normal
// FURTHER function are as defined as in setTableConfig FILE
var setFirstDealer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in function setFirstDealer');
  serverLog(stateOfX.serverLogType.info, 'Round count for this table - ' + params.table.roundCount);
  if(params.table.roundCount === 1) {
    params.data.delaerFound = true;
    params.data.currentDealerSeatIndex = params.data.totalSeatIndexOccupied[0];
  }
  cb(null, params);
};

var setPreDecideDealer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in function setPreDecideDealer');
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
  serverLog(stateOfX.serverLogType.info, 'in function setNewDealer');
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

var setDealerIndexAndSeatIndex = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in function setDealerIndexAndSeatIndex');
  if(params.data.delaerFound) {
    var playerIndexOnTable                   = _ld.findIndex(params.table.players, {seatIndex: params.data.currentDealerSeatIndex});
    params.table.dealerIndex                 = playerIndexOnTable;
    params.table.dealerSeatIndex             = params.data.currentDealerSeatIndex;
    params.tempConfigPlayers.dealerSeatIndex = params.table.dealerSeatIndex;
    serverLog(stateOfX.serverLogType.info, 'Temp dealer seat index - ' + params.tempConfigPlayers.dealerSeatIndex);
    serverLog(stateOfX.serverLogType.info, 'Dealer index in players - ' + params.table.dealerIndex + '  and seat index - ' + params.table.dealerSeatIndex);
    cb(null, params);
  } else {
    serverLog(stateOfX.serverLogType.error, "No dealer decided for new Game");
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SETDEALERINDEXFAIL_TABLECONFIGMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Dealer decision failed for new Game"});
  }
};

// init params in temp object
var initializeParams = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in function initializeParams');
  params.data.delaerFound   = false;
  params.data.smallBlindSet = false;

  params.temp                         = {};
  params.temp.waitingPlayers          = _.where(params.table.players, {state: stateOfX.playerState.waiting});
  params.temp.dealerSeatIndex         = params.table.dealerSeatIndex;
  params.temp.smallBlindSeatIndex     = params.table.smallBlindSeatIndex;
  params.temp.nextSmallBlindSeatIndex = params.table.nextSmallBlindSeatIndex;
  params.temp.bigBlindSeatIndex       = params.table.bigBlindSeatIndex;
  params.temp.dealerIndex             = params.table.dealerIndex;
  params.temp.smallBlindIndex         = params.table.smallBlindIndex;
  params.temp.bigBlindIndex           = params.table.bigBlindIndex;
  params.temp.straddleIndex           = params.table.straddleIndex;
  params.temp.currentMoveIndex        = params.table.currentMoveIndex;
  params.temp.firstActiveIndex        = params.table.firstActiveIndex;
  params.temp.nextDealerSeatIndex     = params.table.nextDealerSeatIndex;

  params.tempConfigPlayers                     = {};
  params.tempConfigPlayers.dealerSeatIndex     = -1;
  params.tempConfigPlayers.smallBlindSeatIndex = -1;
  params.tempConfigPlayers.bigBlindSeatIndex   = -1;

  serverLog(stateOfX.serverLogType.info, 'Temp variables at the start - ' + JSON.stringify(params.temp));
  cb(null, params);
};

var setNextGameDealer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in function setNextGameDealer');
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

var setFirstSmallBlind = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in function setFirstSmallBlind');
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
  serverLog(stateOfX.serverLogType.info, 'in function setSmallBlindToDealer');
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

var setPreDecideSmallBlind = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in function setPreDecideSmallBlind');
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
      ///////// CALLBACK WAS ALREADY CALLED - got here - fixed
      // cb(null, params);
    }
  } else {
    cb(null, params);
  }
};

var resetSmallBlind = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in function resetSmallBlind');
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

var setSmallBlindIndexAndSeatIndex = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in function setSmallBlindIndexAndSeatIndex');
  if(params.data.smallBlindSet) {
    var playerIndexOnTable          = _ld.findIndex(params.table.players, {seatIndex: params.table.smallBlindSeatIndex});
    params.tempConfigPlayers.smallBlindSeatIndex = params.table.smallBlindSeatIndex;
    serverLog(stateOfX.serverLogType.info, 'Temp small blind seat index - ' + params.tempConfigPlayers.smallBlindSeatIndex);
    params.table.smallBlindIndex = playerIndexOnTable;
    serverLog(stateOfX.serverLogType.info, 'Small blind index in players array - ' + params.table.smallBlindIndex + '  and seat index - ' + params.table.smallBlindSeatIndex);
    cb(null, params);
  } else {
    serverLog(stateOfX.serverLogType.error, "Small blind decision failed !");
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.SETSMALLBLINDINDEXFAIL_TABLECONFIGMANAGER});
    //cb({success: false, channelId: params.channelId, info: "Small blind decision failed !"});
  }
};

var setNextGameSmallBlind = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in function setNextGameSmallBlind');
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

var setBigBlindDetails = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in function setBigBlindDetails');
  params.table.bigBlindIndex                 = _ld.findIndex(params.table.players, {seatIndex: params.table.nextSmallBlindSeatIndex});
  params.table.bigBlindSeatIndex             = params.table.players[params.table.bigBlindIndex].seatIndex;
  params.tempConfigPlayers.bigBlindSeatIndex = params.table.nextSmallBlindSeatIndex;
  serverLog(stateOfX.serverLogType.info, 'Temp big blind seat index - ' + params.tempConfigPlayers.dealerSeatIndex);
  serverLog(stateOfX.serverLogType.info, 'Big blind players details - ' + JSON.stringify(params.table.bigBlindIndex));
  cb(null, params);
};

// replace actual variables
// (revert table settings)
var replaceActualVariables = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in function replaceActualVariables');
  serverLog(stateOfX.serverLogType.info, 'Temp variables at the end - ' + JSON.stringify(params.temp));
  params.table.dealerSeatIndex         = params.temp.dealerSeatIndex;
  params.table.smallBlindSeatIndex     = params.temp.smallBlindSeatIndex;
  params.table.nextSmallBlindSeatIndex = params.temp.nextSmallBlindSeatIndex;
  params.table.bigBlindSeatIndex       = params.temp.bigBlindSeatIndex;
  params.table.dealerIndex             = params.temp.dealerIndex;
  params.table.smallBlindIndex         = params.temp.smallBlindIndex;
  params.table.bigBlindIndex           = params.temp.bigBlindIndex;
  params.table.straddleIndex           = params.temp.straddleIndex;
  params.table.currentMoveIndex        = params.temp.currentMoveIndex;
  params.table.firstActiveIndex        = params.temp.firstActiveIndex;
  params.table.nextDealerSeatIndex     = params.temp.nextDealerSeatIndex;

  async.each(params.temp.waitingPlayers, function(player, ecb){
    serverLog(stateOfX.serverLogType.info, 'Processing player - ' + JSON.stringify(player));
    if(_ld.findIndex(params.table.players, {playerId: player.playerId}) >= 0) {
      serverLog(stateOfX.serverLogType.info, 'Player ' + player.playerName + ' present in table players.');
      var playerIndexOnTable = _ld.findIndex(params.table.players, {playerId: player.playerId});
      serverLog(stateOfX.serverLogType.info, 'Player ' + player.playerName + ' index on table - ' + playerIndexOnTable + '.');
      params.table.players[playerIndexOnTable].state = stateOfX.playerState.waiting;
      serverLog(stateOfX.serverLogType.info, 'After Processing player - ' + JSON.stringify(player));
      ecb();
    } else {
      serverLog(stateOfX.serverLogType.info, 'Player ' + player.playerName + ' not present in table players.');
      ecb();
    }
  }, function(err){
    if(!err){
      cb(null, params);
    } else{
      cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.REPLACEACTUALVARIABLESFAIL_TABLECONFIGMANAGER + JSON.stringify(err)});
      //cb({success: false, info: "Replace temp values failed - " + JSON.stringify(err)});
    }
  });
};

// set next game config
// THIS FILE DOES NOT SET THESE THINGS ACTUALLY
// It does them and revert them back
// reason - To find players who will be part of game or not
// WHY SUCH REASON - becoz player sitting in between dealer and SB may not become part of game
tableConfigManager.nextGameConfig = function(params, cb){
  serverLog(stateOfX.serverLogType.info, 'Table while starting config player calculation - ' + JSON.stringify(params.table));
  async.waterfall([
    async.apply(initializeParams, params),

    setPlayersAsPlaying,
    sortPlayerIndexes,

    totalSeatOccpuied,
    setFirstDealer,
    setPreDecideDealer,
    setNewDealer,
    setDealerIndexAndSeatIndex,

    setFirstSmallBlind,
    setSmallBlindToDealer,
    setPreDecideSmallBlind,
    resetSmallBlind,
    setSmallBlindIndexAndSeatIndex,
    setNextGameDealer,
    setNextGameSmallBlind,

    setBigBlindDetails,

    replaceActualVariables

  ], function(err, params){

    serverLog(stateOfX.serverLogType.info, 'after calculating getNextDealerSeatIndex - err' + JSON.stringify(err));
    //serverLog(stateOfX.serverLogType.info, 'after calculating getNextDealerSeatIndex - params' + JSON.stringify(params));

    if(!err && params) {
      cb({success: true, params: params});
    } else {
      cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.GETNEXTDEALERSEATINDEXFAIL_TABLECONFIGMANAGER});
      //cb({success: false, channelId: params.channelId, info: 'Getting next dealer seat index failed !'})
    }
  });
};

// ************* DEALER INDEX DECISION ENDS HERE **************


// ************* SET NEXT GAME DEALER BEGINS HERE **************



// ************* SET NEXT GAME DEALER ENDS HERE **************

// deprecated
tableConfigManager.getNextSmallBlindSeatIndex = function(params, cb){
  cb({success: true, params: params});
};

// deprecated
tableConfigManager.getNextBigBlindSeatIndex = function(params, cb){
  cb({success: true, params: params});
};

module.exports = tableConfigManager;
