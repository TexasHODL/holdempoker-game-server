/*jshint node: true */
"use strict";

var _ld               = require("lodash"),
    _                 = require('underscore'),
    async             = require('async'),
    stateOfX          = require("../../../../../shared/stateOfX"),
    keyValidator      = require("../../../../../shared/keysDictionary"),
    zmqPublish        = require("../../../../../shared/infoPublisher"),
    ofcTableManager   = require('./ofcTableManager'),
    adjustActiveIndex = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'adjustActiveIndex';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### Get next active player index
// > Return next active index corresponding to current player

var getNextActiveIndex = function(params, cb) {
  keyValidator.validateKeySets("Request", params.serverType, "getNextActiveIndex", params, function(validated){
    if(validated.success) {
      ofcTableManager.totalActivePlayers(params, function(totalActivePlayersResponse){
        if(totalActivePlayersResponse.success) {
            var activePlayers = totalActivePlayersResponse.players;
            if(activePlayers.length > 1) {
              var indexInActivePlayers  = _ld.findIndex(activePlayers, params.table.players[params.index]);
              var nextSuitableIndex     = ofcTableManager.getNextSuitableIndex(indexInActivePlayers, activePlayers.length);
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
      ofcTableManager.totalActivePlayers(params, function(totalActivePlayersResponse){
        if(totalActivePlayersResponse.success) {
            var activePlayers = totalActivePlayersResponse.players;
            if(activePlayers.length > 1) {
              var indexInActivePlayers  = _ld.findIndex(activePlayers, params.table.players[params.index]);
              var preSuitableIndex      = ofcTableManager.getPreSuitableIndex(indexInActivePlayers, activePlayers.length);
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
    if((player.state === stateOfX.playerState.disconnected && player.active === true) || (player.state === stateOfX.playerState.playing && player.active === true)) { // Change indexes only for playing players
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
      // serverLog(stateOfX.serverLogType.info, 'This player ' + player.playerName + ' is no more active in the game - ' + player.state + ' !')
      player.preActiveIndex   = -1;
      player.nextActiveIndex  = -1;
      ecb();
    }
  }, function(err){
    if(err) {
      cb({success: false, info: "Active player adjustment failed! - " + JSON.stringify(err)});
    } else {
      cb({success: true, params: params});
    }
  });
};

module.exports=adjustActiveIndex;
