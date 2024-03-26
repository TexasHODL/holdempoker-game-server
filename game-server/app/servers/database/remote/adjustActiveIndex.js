/*jshint node: true */
"use strict";

var _ld               = require("lodash"),
    _                 = require('underscore'),
    async             = require('async'),
    stateOfX          = require("../../../../shared/stateOfX"),
    popupTextManager  = require("../../../../shared/popupTextManager"),
    keyValidator      = require("../../../../shared/keysDictionary"),
    zmqPublish        = require("../../../../shared/infoPublisher"),
    tableManager      = require("./tableManager"),
    adjustActiveIndex = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'adjustActiveIndex';
  logObject.serverName   = stateOfX.serverType.database;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### Get next active player index
// > Return next active index corresponding to current player

var getNextActiveIndex = function(params, cb) {
  keyValidator.validateKeySets("Request", params.serverType, "getNextActiveIndex", params, function(validated){
    if(validated.success) {
      tableManager.totalActivePlayers(params, function(totalActivePlayersResponse){
        if(totalActivePlayersResponse.success) {
            var activePlayers = totalActivePlayersResponse.players;
            if(activePlayers.length > 1) {
              var indexInActivePlayers  = _ld.findIndex(activePlayers, params.table.players[params.index]);
              var nextSuitableIndex     = tableManager.getNextSuitableIndex(indexInActivePlayers, activePlayers.length);
              var indexInPlayers        = _ld.findIndex(params.table.players, activePlayers[nextSuitableIndex]);
              cb({success: true, index: indexInPlayers});
            } else {
              cb({success: true, index: params.index});
            }
        } else {
          cb(totalActivePlayersResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Get previous active player index
// > Return previous active index corresponding to current player

var getPreActiveIndex = function(params, cb) {
  keyValidator.validateKeySets("Request", params.serverType, "getPreActiveIndex", params, function(validated){
    if(validated.success) {
      tableManager.totalActivePlayers(params, function(totalActivePlayersResponse){
        if(totalActivePlayersResponse.success) {
            var activePlayers = totalActivePlayersResponse.players;
            if(activePlayers.length > 1) {
              var indexInActivePlayers  = _ld.findIndex(activePlayers, params.table.players[params.index]);
              var preSuitableIndex      = tableManager.getPreSuitableIndex(indexInActivePlayers, activePlayers.length);
              var indexInPlayers        = _ld.findIndex(params.table.players, activePlayers[preSuitableIndex]);
              cb({success: true, index: indexInPlayers});
            } else {
              cb({success: true, index: params.index});
            }
        } else {
          cb(totalActivePlayersResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Adjust next and previous active players indexes among players

adjustActiveIndex.perform = function(params, cb) {
  // serverLog(stateOfX.serverLogType.info, 'players before adjusting indexes - ' + JSON.stringify(params.table.players))
  async.each(params.table.players, function(player, ecb){
    // serverLog(stateOfX.serverLogType.info, 'adjusting index for player - ' + JSON.stringify(player))
    // var isActivePlayer = player.state === stateOfX.playerState.disconnected && player.active === true;
    // isActivePlayer     = player.state === stateOfX.playerState.playing && player.active === true;
    // isActivePlayer     = params.table.channelType === stateOfX.gameType.tournament && player.lastMove !== stateOfX.move.fold;
     

     // THIS LINE ADDED BECUSE DISCONNECTED PLAYE AUTO MOVE WAS NOT PERFORMING NEW CODE START
     var isActivePlayer = false;
        if(params.table.onStartPlayers.indexOf(player.playerId) >= 0 && player.active){
          isActivePlayer = true;
     } 
     //NEW CODE END
    //var isActivePlayer = player.state === stateOfX.playerState.disconnected && player.active === true;
    // isActivePlayer     = player.state === stateOfX.playerState.playing && player.active === true;
    if(params.table.channelType === stateOfX.gameType.tournament) {
      isActivePlayer = player.lastMove !== stateOfX.move.fold;
    }

    serverLog(stateOfX.serverLogType.info, 'Processing player while adjusting indexes - ' + JSON.stringify(player));

    if(isActivePlayer) { // Change indexes only for playing/active players
      var index = _ld.findIndex(params.table.players, player);
      getPreActiveIndex({serverType: params.serverType, channelId: params.channelId, index: index, table: params.table}, function(getPreActiveIndexResponse){
        if(getPreActiveIndexResponse.success){
          getNextActiveIndex({serverType: params.serverType, channelId: params.channelId, index: index, table: params.table}, function(getNextActiveIndexResponse){
            if(getNextActiveIndexResponse.success){
              player.preActiveIndex   = getPreActiveIndexResponse.index;
              player.nextActiveIndex  = getNextActiveIndexResponse.index;
              // serverLog(stateOfX.serverLogType.info, 'after updating indexes for this player - ' + JSON.stringify(player))
              ecb();
            } else {
              ecb(getNextActiveIndexResponse);
            }
          });
        } else {
          ecb(getPreActiveIndexResponse);
        }
      });
    } else {
      serverLog(stateOfX.serverLogType.info, 'This player ' + player.playerName + ' is no more active in the game - ' + player.state + ' !');
      player.preActiveIndex   = -1;
      player.nextActiveIndex  = -1;
      ecb();
    }
  }, function(err){
    if(err) {
      cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || "") , info:  popupTextManager.falseMessages.ACTIVE_PLAYER_ADJUSTMENT_FAILED + JSON.stringify(err)});
    } else {
      cb({success: true, params: params});
    }
  });
};


// Get previous playing player index by index of current player

adjustActiveIndex.getPrePlayingByIndex = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'About to get previous playing player index from - ' + params.index);
  var index = params.index-1 < 0 ? params.table.players.length-1 : params.index-1;
  var players = {};
  for(var i=0; i<params.table.players.length; i++) {
    var player = params.table.players[index];
    serverLog(stateOfX.serverLogType.info, 'Processing player to check previous playing player: ' + JSON.stringify(player));
    serverLog(stateOfX.serverLogType.info, player.playerName + ' state for check previous playing player: ' + player.state);
    // Waiting player case added, when waiting player also selected to sitout next BB, so we need to check for that player as well
    if(player.state === stateOfX.playerState.playing) {
      serverLog(stateOfX.serverLogType.info, 'Return index: ' + index);
      break;
    } else {
      serverLog(stateOfX.serverLogType.info, 'This is not a playing or waiting player');
    }
    index--;
    if(index < 0) {
      index = params.table.players.length-1;
    }
  }
  cb({success: true, index: index});
  return;
  // tableManager.totalPlayingPlayers(params, function(totalPlayingPlayersResponse){
  //   serverLog(stateOfX.serverLogType.info, 'Total playing players response from tableManager - ' + JSON.stringify(totalPlayingPlayersResponse));
  //   if(totalPlayingPlayersResponse.success) {
  //     var playingPlayers = totalPlayingPlayersResponse.players;
  //     if(playingPlayers.length > 1) {
  //       var indexInPlayingPlayers = _ld.findIndex(playingPlayers, params.table.players[params.index]);
  //       var preSuitableIndex      = tableManager.getPreSuitableIndex(indexInPlayingPlayers, playingPlayers.length);
  //       var indexInPlayers        = _ld.findIndex(params.table.players, playingPlayers[preSuitableIndex]);
  //       serverLog(stateOfX.serverLogType.info, 'Previous playing players index will be - ' + indexInPlayers);
  //       cb({success: true, index: indexInPlayers});
  //     } else {
  //       serverLog(stateOfX.serverLogType.info, 'There is less than 2 playing players on table, responding same index.');
  //       cb({success: true, index: params.index});
  //     }
  //   } else {
  //     cb(totalPlayingPlayersResponse);
  //   }
  // });
};

// Get previous player index by seatIndex of current player
// Previous player state must be playing
// If getting big blind index then skip state check

adjustActiveIndex.getPrePlayerBySeatIndex = function(params, cb) {

  // Return if requesting from a seat that exceed boundary limits
  if(parseInt(params.seatIndex) < 1 || parseInt(params.seatIndex) > parseInt(params.table.maxPlayers)) {
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || "") , info: popupTextManager.falseMessages.EXCEED_BOUNDARY_LIMITS});
  }

  // if looking from first seat then return last seat index player details
  if(parseInt(params.seatIndex) === 1) {
    cb({success: true, seatIndex: parseInt(params.table.maxPlayers)});
    return true;
  }

  // Return seatIndex -1 if looking for any other seat
  cb({success: true, seatIndex: parseInt(params.seatIndex) - 1});
};

module.exports=adjustActiveIndex;
