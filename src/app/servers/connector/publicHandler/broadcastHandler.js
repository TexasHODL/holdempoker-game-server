/*jshint node: true */
"use strict";

// This file is used to handle all the broadcasts
// > Event broadcast handler
// > Request from different events in Game
// > Broadcasts can be sent to channel level or player level
// > Broadcasts can be sent to all connected clients
// > Broadcasts can be sent to channel members privately

// ### External files and packages declaration ###
var _                     = require('underscore'),
    async                 = require("async"),
    // startGameHandler      = require("./startGameHandler"),
    // channelTimerHandler   = require("./channelTimerHandler"),
    // videoHandler          = require("./videoHandler"),
    keyValidator          = require("../../../../shared/keysDictionary"),
    stateOfX              = require("../../../../shared/stateOfX.js"),
    zmqPublish            = require("../../../../shared/infoPublisher.js"),
    configMsg             = require('../../../../shared/popupTextManager').falseMessages,
    dbConfigMsg           = require('../../../../shared/popupTextManager').dbQyeryInfo;

const configConstants = require('../../../../shared/configConstants');
var pomelo = require('pomelo');

function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'broadcastHandler';
  logObject.serverName   = stateOfX.serverType.connector;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  zmqPublish.sendLogMessage(logObject);
}
// var broadcastHandler = {};
function broadcastHandler() {}

/**
 * to broadcast a single player through entryRemote.js function
 * @method sendMessageToUser
 * @param  {Object}          params contains route data playerId
 */
broadcastHandler.sendMessageToUser = function (params) {
   keyValidator.validateKeySets("Request", "connector", "sendMessageToUser", params, function (validated){
    if(validated.success) {
      pomelo.app.rpcInvoke(pomelo.app.get('serverId'), {namespace: "user", service: "entryRemote", method: "sendMessageToUser", args: [params.playerId, params.msg, params.route]}, function(data){
        serverLog(stateOfX.serverLogType.broadcast, params.route + ' - '+ JSON.stringify(params.msg));
        serverLog(stateOfX.serverLogType.info, 'Response from sending broadcast to individual user for - ' + params.route + ' - ' + JSON.stringify(data));
      });
    } else {
      serverLog(stateOfX.serverLogType.error, 'Key validation failed - ' + JSON.stringify(validated));
    }
  });
};

/**
 * Broadcast to all channels joined by any player
 * used in cases like - avtar change of player
 * @method fireBroadcastOnSession
 * @param  {Object}               params contains session, route, data, 
 */
broadcastHandler.fireBroadcastOnSession = function (params) {
   keyValidator.validateKeySets("Request", "connector", "fireBroadcastOnSession", params, function (validated){
    if(validated.success) {
      var sessionChannels =  !!params.session.get("channels") ? params.session.get("channels") : [];
      if(sessionChannels.length > 0) {
        serverLog(stateOfX.serverLogType.info, 'Channels joined in this session - ' + sessionChannels);
        var channel = null;
        async.each(sessionChannels, function(sessionChannelId, ecb){
          serverLog(stateOfX.serverLogType.info, 'Processing channel on broadcast - ' + sessionChannelId);
          params.broadcastData.channelId = sessionChannelId;
          serverLog(stateOfX.serverLogType.broadcast, params.broadcastName + " - " + params.broadcastData);
          pomelo.app.rpc.room.broadcastRemote.pushMessage(params.session, {
            channelId: sessionChannelId,
            route: params.broadcastName,
            msg: params.broadcastData
          }, function(){
            console.log('buddy Request broadcast sent');
          });
          // channel = params.self.app.get('channelService').getChannel(sessionChannel, false);
          // if(!!channel) {
          //   params.broadcastData.channelId = sessionChannel;
          //   serverLog(stateOfX.serverLogType.broadcast, params.broadcastName + " - " + params.broadcastData);
          //   channel.pushMessage(params.broadcastName, params.broadcastData);
          // }
          ecb();
        }, function(err){
          if(err) {
            serverLog(stateOfX.serverLogType.info, params.broadcastName + ' broadcast to all channels failed!');
          } else {
            serverLog(stateOfX.serverLogType.info, params.broadcastName + ' broadcast has been sent to all channels successfully!');
          }
        });
      } else {
        serverLog(stateOfX.serverLogType.info, 'AllChannelBroadcast: Player was not joined into any channel!');
      }
    } else {
      serverLog(stateOfX.serverLogType.error, 'AllChannelBroadcast: Key validation failed - ' + JSON.stringify(validated));
    }
  });
};

// ### Broadcast start game on table
// > Inform clien to start a game on table and provide details
// > Get current config for table
// > channelId, currentPlayerId, smallBlindId, bigBlindId, dealerId, straddleId, bigBlind, smallBlind, pot, roundMaxBet, state, playerCards
// broadcastHandler.fireStartGameBroadcast = function (params, cb) {
//   keyValidator.validateKeySets("Request", "connector", "fireStartGameBroadcast", params, function (validated){
//     if(validated.success) {
//       serverLog(stateOfX.serverLogType.broadcast, "startGame- " + JSON.stringify(params.broadcastData));
//       params.channel.pushMessage("startGame", params.broadcastData);
//       videoHandler.createVideo({roundId: params.channel.roundId, channelId: params.broadcastData.channelId, type: stateOfX.videoLogEventType.broadcast, data: params.broadcastData}, function(res){});
//       cb({success: true});
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending start game broadcast - ' + JSON.stringify(validated))
//       cb(validated);
//     }
//   });
// }

// fire break start broadcast of a channel in normal tournament
// broadcastHandler.sendBroadcastForBreak = function(params) {
//   keyValidator.validateKeySets("Request", "connector", "sendBroadcastForBreak", params, function (validated){
//     if(validated.success) {
//       serverLog(stateOfX.serverLogType.broadcast, "sendBroadcastForBreak- " + JSON.stringify(params.breakTime));
//       params.channel.pushMessage("breakTime", {breakTime : params.breakTime, channelId: params.channelId});
//       // cb({success: true});
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending sendBroadcastForBreak - ' + JSON.stringify(validated))
//       // cb(validated);
//     }
//   });
// }

// fire break timer broadcast of a channel in normal tournament
// broadcastHandler.sendBroadcastForBreakTimer = function(params, cb) {
//   keyValidator.validateKeySets("Request", "connector", "sendBroadcastForBreakTimer", params, function (validated){
//     if(validated.success) {
//       serverLog(stateOfX.serverLogType.broadcast, "sendBroadcastForBreakTimer- " + JSON.stringify(params.breakTime));
//       params.channel.pushMessage("breakTimerStart", {breakTime : params.breakTime, channelId: params.channelId});
//       // cb({success: true});
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending sendBroadcastForBreakTimer - ' + JSON.stringify(validated))
//       // cb(validated);
//     }
//   });
// }

//### this function is used to fire broadcast to users who took part in tournament
broadcastHandler.fireBroadcastForStartTournament = function(params,cb) {
  keyValidator.validateKeySets("Request", "connector", "fireBroadcastForStartTournament", params, function (validated) {
    if(validated.success) {
      //send broadcast to users
      broadcastHandler.sendMessageToUser({self: pomelo, playerId: params.playerId, msg: {tableId: params.tableId,channelId: params.channelId, playerId: params.playerId,gameStartsIn: params.msg.timer, tableDetails: params.msg.table.tableDetails, roomConfig: params.msg.table.roomConfig, settings: params.msg.table.settings, forceJoin: true, info: params.msg.table.tableDetails.tournamentName.toUpperCase() + " tournament has been started!"}, route: params.route});
      setTimeout(function(){
        broadcastHandler.sendMessageToUser({self: pomelo, playerId: params.playerId, msg: {tableId: params.tableId,channelId: params.channelId, playerId: params.playerId, info: params.msg.table.tableDetails.tournamentName.toUpperCase() + " rebuy time has been started!"}, route: params.route});
      },10000);
      cb({success: true});
    } else {
      cb(validated);
    }
  });
};


// fire rebuy broadcast of a channel in normal tournament
// broadcastHandler.fireBroadcastForRebuyStatus = function(params, cb) {
//   keyValidator.validateKeySets("Request", "connector", "fireBroadcastForRebuyStatus", params, function (validated){
//     if(validated.success) {
//       serverLog(stateOfX.serverLogType.broadcast, "fireBroadcastForRebuyStatus- " + params.rebuyStatus + params.channelId);
//       params.channel.pushMessage("rebuyStatus", {status: params.rebuyStatus, channelId: params.channelId});
//       // cb({success: true});
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending fireBroadcastForRebuyStatus - ' + JSON.stringify(validated))
//       // cb(validated);
//     }
//   });
// }


// fire rebuy about to end broadcast of a channel in normal tournament
// broadcastHandler.fireBroadcastForRebuyAboutToEnd = function(params, cb) {
//   keyValidator.validateKeySets("Request", "connector", "fireBroadcastForRebuyAboutToEnd", params, function (validated){
//     if(validated.success) {
//       serverLog(stateOfX.serverLogType.broadcast, "fireBroadcastForRebuyAboutToEnd- " + params.rebuyTimeEnds + params.channelId);
//       params.channel.pushMessage("rebuyTimeEnds", {info:"Rebuy period is going to end in next "+params.rebuyTimeEnds+" minutes", channelId: params.channelId});
//       // cb({success: true});
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending fireBroadcastForRebuyAboutToEnd - ' + JSON.stringify(validated))
//       // cb(validated);
//     }
//   });
// }


// broadcastHandler.fireBroadcastForAddon = function(params, cb) {
//   keyValidator.validateKeySets("Request", "connector", "fireBroadcastForAddon", params, function (validated){
//     if(validated.success) {
//       serverLog(stateOfX.serverLogType.broadcast, "fireBroadcastForAddon- " + params.info);
//       params.channel.pushMessage(params.route, {info: params.info, channelId: params.channelId});
//       // cb({success: true});
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending fireBroadcastForAddon - ' + JSON.stringify(validated))
//       // cb(validated);
//     }
//   });
// }

// ### Broadcast for client-server connection
// deprecated
broadcastHandler.fireAckBroadcastDep = function (params) {
  keyValidator.validateKeySets("Request", "connector", "fireAckBroadcast", params, function (validated){
    if(validated.success) {
      broadcastHandler.sendMessageToUser({self: pomelo, playerId: params.playerId, msg: {channelId: params.channelId, playerId: params.playerId}, route: "connectionAck"});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending ack broadcast - ' + JSON.stringify(validated));
    }
  });
};

// tournament
broadcastHandler.fireNewChannelBroadcast = function (params) {
  keyValidator.validateKeySets("Request", "connector", "fireNewChannelBroadcast", params, function (validated){
    if(validated.success) {
      broadcastHandler.sendMessageToUser({self: pomelo, playerId: params.playerId, msg: {channelId: params.channelId, playerId: params.playerId, newChannelId:params.newChannelId }, route: "playerNewChannelBroadcast"});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending playerNewChannelBroadcast - ' + JSON.stringify(validated));
    }
  });
};

/**
 * broadcast when player gets a seat from waiting list
 * @method autoJoinBroadcast
 * @param  {Object}          params contains data, route
 */
broadcastHandler.autoJoinBroadcast = function (params) {
  keyValidator.validateKeySets("Request", "connector", "autoJoinBroadcast", params, function (validated){
    if(validated.success) {
      broadcastHandler.sendMessageToUser({self: pomelo, playerId: params.playerId, msg: _.omit(params,"self","session"), route: "autoJoinBroadcast"});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending playerNewChannelBroadcast - ' + JSON.stringify(validated));
    }
  });
};

//### this function send broadcast when any player eliminate.
// tournament
broadcastHandler.firePlayerEliminateBroadcast = function(params,cb) {
  keyValidator.validateKeySets("Request", "connector", "firePlayerEliminateBroadcast", params, function (validated) {
    if(validated.success) {
      //send broadcast to users
      serverLog(stateOfX.serverLogType.info, "going to send broadcast for player eliminate");
      setTimeout(function(){
        broadcastHandler.sendMessageToUser({self: pomelo, playerId: params.playerId, msg: {channelId: params.channelId, playerId: params.playerId,tournamentId: params.tournamentId,chipsWon: Math.round(params.chipsWon) || 0, rank:params.rank, gameVersionCount: params.gameVersionCount,isGameRunning: params.isGameRunning,isRebuyOpened: params.isRebuyOpened, tournamentName: params.tournamentName, tournamentType: params.tournamentType, ticketsWon:params.ticketsWon || 0}, route: params.route});
      },(configConstants.gameOverBroadcastDelay*1000 + 100));
      cb({success: true});
    } else {
      cb(validated);
    }
  });
};


//### this function send broadcast when tournament gets cancelled.
/**
 * function to send message to registered users about tournament cancellation
 *
 * @method fireTournamentCancelledBroadcast
 * @param  {Object}       params  request json object
 * @return {Object}               validated object
 */
broadcastHandler.fireTournamentCancelledBroadcast = function(params) {
  serverLog(stateOfX.serverLogType.info, "in fireTournamentCancelledBroadcast  " + params);
  keyValidator.validateKeySets("Request", "connector", "fireTournamentCancelledBroadcast", params, function (validated) {
    if(validated.success) {
      //send broadcast to users
      serverLog(stateOfX.serverLogType.info, "going to send broadcast for tournament cancelled ");
      broadcastHandler.sendMessageToUser({self: pomelo, playerId: params.playerId, msg: { playerId: params.playerId, tournamentId: params.tournamentId, info: "Tournament has been cancelled."}, route: params.route});
    } else {
      serverLog(stateOfX.serverLogType.info, "error in key validation in fireTournamentCancelledBroadcast ");
      
    }
  });
};

// ### Broadcast sit of this player
// broadcastHandler.fireSitBroadcast = function (params) {
//   keyValidator.validateKeySets("Request", "connector", "fireSitBroadcast", params, function (validated){
//     if(validated.success) {
//       var data = {channelId: params.table.channelId, playerId: params.player.playerId, chips: params.player.chips, seatIndex: params.player.seatIndex, playerName: params.player.playerName, imageAvtar: params.player.imageAvtar, state: params.player.state};
//       serverLog(stateOfX.serverLogType.broadcast, 'sit- ' + JSON.stringify(data));
//       params.channel.pushMessage('sit', data);
//       videoHandler.createVideo({roundId: params.channel.roundId, channelId: params.table.channelId, type: stateOfX.videoLogEventType.broadcast, data: data}, function(res){});
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending sit broadcast - ' + JSON.stringify(validated))
//     }
//   });
// }

// player sit broadcast while shuffling
broadcastHandler.fireSitBroadcastInShuffling = function (params) {
  serverLog(stateOfX.serverLogType.info, "params is in fireSitBroadcastInShuffling - ",params.newChannelId);
  keyValidator.validateKeySets("Request", "connector", "fireSitBroadcastInShuffling", params, function (validated){
    if(validated.success) {
      var data = {channelId: params.newChannelId, playerId: params.playerId, chips: params.chips, seatIndex: params.seatIndex, playerName: params.playerName, imageAvtar: params.imageAvtar};
      serverLog(stateOfX.serverLogType.broadcast, 'sit- ' + JSON.stringify(data));
      params.channel.pushMessage('sit', data);
      videoHandler.createVideo({roundId: params.channel.roundId, channelId: params.newChannelId, type: stateOfX.videoLogEventType.broadcast, data: data}, function(res){});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending sit broadcast - ' + JSON.stringify(validated));
    }
  });
};

// ### Broadcast players with state before next game start
// broadcastHandler.fireTablePlayersBroadcast = function (params) {
//   keyValidator.validateKeySets("Request", "connector", "fireTablePlayersBroadcast", params, function (validated){
//     if(validated.success) {
//       var data = {channelId: params.channelId, players: _.map(params.players,function(player){return _.pick(player,'playerId','chips','state','moves')}), removed: params.removed};
//       serverLog(stateOfX.serverLogType.broadcast, "gamePlayers- " + JSON.stringify(data));
//       params.channel.pushMessage("gamePlayers", data);
//       if(params.channel.gameStartEventSet !== stateOfX.startGameEventOnChannel.idle) {
//         videoHandler.createVideo({roundId: params.channel.roundId, channelId: params.channelId, type: stateOfX.videoLogEventType.broadcast, data: data}, function(res){});
//       } else {
//         serverLog(stateOfX.serverLogType.info, "Not storing this game players for video log, as game is not going to start here!");
//       }
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending game players broadcast - ' + JSON.stringify(validated))
//     }
//   });
// }

// ### Broadcast cards distribution to each players
// broadcastHandler.fireCardDistributeBroadcast = function (params, cb) {
//   keyValidator.validateKeySets("Request", "connector", "fireCardDistributeBroadcast", params, function (validated){
//     if(validated.success) {
//       // Send card distribution broadcast to each players
//       async.each(params.players, function (player, ecb){
//         // broadcastHandler.sendMessageToUser({self: params.self, playerId: player.playerId, msg: {channelId: params.channelId, playerId: player.playerId, cards: player.cards}, route: "playerCards"});
//         var data = {channelId: params.channelId, playerId: player.playerId, cards: player.cards}
//         params.self.app.get('channelService').pushMessageByUids('playerCards', data, [{uid: player.playerId, sid: params.self.app.get('serverId')}], [], function(response){
//           serverLog(stateOfX.serverLogType.info, 'playerCard broadcast sent to player successfully!');
//           videoHandler.createVideo({roundId: params.channel.roundId, channelId: params.channelId, type: stateOfX.videoLogEventType.broadcast, data: data}, function(res){});
//         })
//         ecb();
//       }, function (err){
//         if(err) {
//           serverLog(stateOfX.serverLogType.error, 'Error while sending playe cards broadcast: ' + JSON.stringify(err));
//           // cb({success: false, info: "Cards distribution broadcast failed! - " + err});
//           cb({success: false, info: configMsg.FIRECARDDISTRIBUTEBROADCASTFAIL_BROADCASTHANDLER, isRetry: false, isDisplay: true, channelId: ""});
//         } else {
//           cb({success: true})
//         }
//       });
//     } else {
//       cb(validated);
//     }
//   });
// }

// ### Send blind deduction on table

// broadcastHandler.fireDeductBlindBroadcast = function (params, cb) {
//   keyValidator.validateKeySets("Request", "connector", "fireDeductBlindBroadcast", params.data, function (validated){
//     if(validated.success) {
//       serverLog(stateOfX.serverLogType.broadcast, "blindDeduction: " + JSON.stringify(params.data));
//       params.channel.pushMessage("blindDeduction", params.data);
//       videoHandler.createVideo({roundId: params.channel.roundId, channelId: params.data.channelId, type: stateOfX.videoLogEventType.broadcast, data: params.data}, function(res){});
//       cb({success: true});
//     } else {
//       cb(validated);
//     }
//   });
// }

// ### Broadcast after an action performed

// broadcastHandler.fireOnTurnBroadcast = function (params, cb) {
//   keyValidator.validateKeySets("Request", "connector", "fireOnTurnBroadcast", params, function (validated){
//     if(validated.success) {
//       var data = _.omit(params, 'self', 'channel', 'session');
//       serverLog(stateOfX.serverLogType.broadcast, "turn- " + JSON.stringify(_.omit(params, 'self', 'channel', 'session')));
//       params.channel.pushMessage("turn", data);
//       videoHandler.createVideo({roundId: params.channel.roundId, channelId: data.channelId, type: stateOfX.videoLogEventType.broadcast, data: data}, function(res){});
//       cb({success: true});
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending on turn broadcast - ' + JSON.stringify(validated))
//       // cb({success: false, info: 'Error while sending on turn broadcast - ' + JSON.stringify(validated)});
//       cb({success: false, info: configMsg.FIREONTURNBROADCASTFAIL_BROADCASTHANDLER + JSON.stringify(validated), isRetry: false, isDisplay: false, channelId: ""});
//     }
//   });
// }

// ### Broadcast round over

// broadcastHandler.fireRoundOverBroadcast = function (params) {
//   keyValidator.validateKeySets("Request", "connector", "fireRoundOverBroadcast", params, function (validated){
//     if(validated.success) {
//       var data =  _.omit(params, 'self', 'channel');
//       serverLog(stateOfX.serverLogType.broadcast,"roundOver- " + JSON.stringify(_.omit(params, 'self', 'channel')));
//       params.channel.pushMessage("roundOver",data);
//       videoHandler.createVideo({roundId: params.channel.roundId, channelId: data.channelId, type: stateOfX.videoLogEventType.broadcast, data: data}, function(res){});
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending sit broadcast - ' + JSON.stringify(validated))
//     }
//   });
// }

// ### Player state broadcast to player only

// broadcastHandler.firePlayerStateBroadcast = function (params) {
//   keyValidator.validateKeySets("Request", "connector", "firePlayerStateBroadcast", params, function (validated){
//     if(validated.success) {
//       var data = {channelId: params.channelId, playerId: params.playerId, state: params.state};
//       serverLog(stateOfX.serverLogType.broadcast,"playerState- " + JSON.stringify({channelId: params.channelId, playerId: params.playerId, state: params.state}));
//       params.channel.pushMessage('playerState', data)
//       videoHandler.createVideo({roundId: params.channel.roundId, channelId: params.channel.channelId, type: stateOfX.videoLogEventType.broadcast, data: data}, function(res){});
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending player state broadcast - ' + JSON.stringify(validated))
//     }
//   });
// }


// ### Send player broadcast in order to display buyin popup
// > In cases when player perform events when bankrupt

broadcastHandler.fireBankruptBroadcast = function (params) {
  keyValidator.validateKeySets("Request", "connector", "fireBankruptBroadcast", params, function (validated){
    if(validated.success) {
      broadcastHandler.sendMessageToUser({self: pomelo, playerId: params.playerId, msg: {channelId: params.channelId, playerId: params.playerId}, route: "bankrupt"});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending player state broadcast - ' + JSON.stringify(validated));
    }
  });
};

// ### Fire player amount broadcast to channel level
// > If player have opted to add chips in the middle of the game
// It updates game balance of player
broadcastHandler.firePlayerCoinBroadcast = function (params) {
  keyValidator.validateKeySets("Request", "connector", "firePlayerCoinBroadcast", params, function (validated){
    if(validated.success) {
      var data = {channelId: params.channelId, playerId: params.playerId, amount: params.amount};
      serverLog(stateOfX.serverLogType.broadcast,"playerCoins- " + JSON.stringify({channelId: params.channelId, playerId: params.playerId, amount: params.amount}));
      params.channel.pushMessage("playerCoins", data);
      // videoHandler.createVideo({roundId: params.channel.roundId, channelId: data.channelId, type: stateOfX.videoLogEventType.broadcast, data: data}, function(res){});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending player state broadcast - ' + JSON.stringify(validated));
    }
  });
};

// ### Broadcast dealer chat to table
//
// broadcastHandler.fireDealerChat = function (params) {
//   serverLog(stateOfX.serverLogType.broadcast,"delaerChat- " + JSON.stringify({channelId: params.channelId, message: params.message}));
//   params.channel.pushMessage('delaerChat', {channelId: params.channelId, message: params.message});
// }

// ### Leave barodcast to channel

// broadcastHandler.fireLeaveBroadcast = function (params) {
//   keyValidator.validateKeySets("Request", "connector", "fireLeaveBroadcast", params, function (validated){
//     if(validated.success) {
//       serverLog(stateOfX.serverLogType.info, "leave broadcast data --" + JSON.stringify(params.data));
//       serverLog(stateOfX.serverLogType.broadcast,"leave- " + JSON.stringify(params.data));
//       params.channel.pushMessage("leave", params.data);
//       serverLog(stateOfX.serverLogType.info, '----- Leave Broadcast Fired --------');
//       videoHandler.createVideo({roundId: params.channel.roundId, channelId: params.data.channelId, type: stateOfX.videoLogEventType.broadcast, data: params.data}, function(res){});
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending leave broadcast - ' + JSON.stringify(validated))
//     }
//   });
// }

// ### Broadcast round over

// broadcastHandler.fireGameOverBroadcast = function (params) {
//   keyValidator.validateKeySets("Request", "connector", "fireGameOverBroadcast", params, function (validated){
//     if(validated.success) {
//       var data = _.omit(params, 'self', 'channel', 'session');
//       serverLog(stateOfX.serverLogType.info, "Game over broadcast will be fired after a delay of " + parseInt(configConstants.gameOverBroadcastDelay) + " seconds.");
//       setTimeout(function(){
//         serverLog(stateOfX.serverLogType.broadcast,"gameOver- " + JSON.stringify(_.omit(params, 'self', 'channel', 'session')));
//         params.channel.pushMessage("gameOver", data);
//         videoHandler.createVideo({roundId: params.channel.roundId, channelId: data.channelId, type: stateOfX.videoLogEventType.broadcast, data: data}, function(res){});
//       }, parseInt(configConstants.gameOverBroadcastDelay)*1000)
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending game over broadcast - ' + JSON.stringify(validated))
//     }
//   });
// }

// Fire precheck broadcast to individual players

// broadcastHandler.firePrecheckBroadcast = function (params) {
//   async.each(params, function (precheck, ecb){
//     var data = {channelId: params.channelId, playerId: precheck.playerId, set: precheck.set};
//     broadcastHandler.sendMessageToUser({self: params.self, playerId: precheck.playerId, msg: data, route: "preCheck"});
//     data.route = "preCheck";
//     videoHandler.createVideo({roundId: params.channel.roundId, channelId: params.channelId, type: stateOfX.videoLogEventType.broadcast, data: data}, function(res){});
//     ecb();
//   }, function (err){
//     if(err) {
//       serverLog(stateOfX.serverLogType.error, "Precheck broadcast failed! - " + err);
//     } else {
//       serverLog(stateOfX.serverLogType.info, 'Precheck successfully broadcasted to all players.')
//     }
//   });
// }


// Fire best hand broadcast to individual players

// broadcastHandler.fireBestHandBroadcast = function (params) {
//   async.each(params, function (bestHand, ecb){
//     var data = {channelId: params.channelId, playerId: bestHand.playerId, bestHand: bestHand.bestHand};
//     broadcastHandler.sendMessageToUser({self: params.self, playerId: bestHand.playerId, msg: data, route: "bestHands"});
//     data.route = "bestHands";
//     videoHandler.createVideo({roundId: params.channel.roundId, channelId: params.channelId, type: stateOfX.videoLogEventType.broadcast, data: data}, function(res){});
//     ecb();
//   }, function (err){
//     if(err) {
//       serverLog(stateOfX.serverLogType.error, "Best hands broadcast failed! - " + err);
//     } else {
//       serverLog(stateOfX.serverLogType.info, 'Best hands successfully broadcasted to all players.')
//     }
//   });
// }


// General info broadcast to client (player level)

broadcastHandler.fireInfoBroadcastToPlayer = function (params) {
  keyValidator.validateKeySets("Request", "connector", "fireInfoBroadcastToPlayer", params, function (validated){
    if(validated.success) {
      broadcastHandler.sendMessageToUser({self: pomelo, playerId: params.playerId, msg: {heading: params.heading, info: params.info, channelId: params.channelId, playerId: params.playerId, buttonCode: params.buttonCode}, route: "playerInfo"});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending info broadcast to player - ' + JSON.stringify(validated));
    }
  });
};

// General info broadcast to client (channel level)

// broadcastHandler.fireInfoBroadcastToChannel = function (params) {
//   keyValidator.validateKeySets("Request", "connector", "fireInfoBroadcastToChannel", params, function (validated){
//     if(validated.success) {
//       serverLog(stateOfX.serverLogType.broadcast,"channelInfo- " + JSON.stringify({heading: params.heading, info: params.info, channelId: params.channelId}));
//       params.channel.pushMessage("channelInfo", {heading: params.heading, info: params.info, channelId: params.channelId});
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending info broadcast on channel - ' + JSON.stringify(validated))
//     }
//   });
// }

// Broadcast chat message to any channel

// broadcastHandler.fireChatBroadcast = function (params) {
//   keyValidator.validateKeySets("Request", "connector", "fireChatBroadcast", params, function (validated){
//     if(validated.success) {
//       serverLog(stateOfX.serverLogType.broadcast,"chat- " + JSON.stringify({channelId: params.channelId, playerId: params.playerId, playerName: params.playerName, message: params.message}));
//       params.channel.pushMessage('chat', {channelId: params.channelId, playerId: params.playerId, playerName: params.playerName, message: params.message});
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending info broadcast on channel - ' + JSON.stringify(validated))
//     }
//   });
// }

// Add a new hand history row into hand tab to all player on table

// broadcastHandler.fireHandtabBroadcast = function(params) {
//   keyValidator.validateKeySets("Request", "connector", "fireHandtabBroadcast", params, function (validated){
//     if(validated.success) {
//       serverLog(stateOfX.serverLogType.broadcast,"handTab- " + JSON.stringify({channelId: params.channelId, handTab: params.handTab}));
//       params.channel.pushMessage('handTab', {channelId: params.channelId, handTab: params.handTab});
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending hand tab broadcast on channel - ' + JSON.stringify(validated))
//     }
//   });
// }

// Fire connection acknowledgement broadcast on session

broadcastHandler.fireAckBroadcastOnLogin = function(params) {
  keyValidator.validateKeySets("Request", "connector", "fireAckBroadcastOnLogin", params, function (validated){
    if(validated.success) {
      broadcastHandler.sendMessageToUser({self: pomelo, playerId: params.playerId, msg: {playerId: params.playerId, data: params.data}, route: "isConnectedOnLogin"});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while fireAckBroadcastOnLogin - ' + JSON.stringify(validated));
    }
  });
};


// sends a broadcast to single player - dynamic route
// params contains data, playerId, route
broadcastHandler.sendCustomMessageToUser = function(params) {
  keyValidator.validateKeySets("Request", "connector", "sendCustomMessageToUser", params, function (validated){
    if(validated.success) {
      broadcastHandler.sendMessageToUser({self: pomelo, playerId: params.playerId, msg: {playerId: params.playerId, data: params.data}, route: params.route});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sendCustomMessageToUser - ' + JSON.stringify(validated));
    }
  });
};


// ### Broadcast delaer chat disabled in case of ALLIN

// broadcastHandler.fireChatDisabled = function (params) {
//   keyValidator.validateKeySets("Request", "connector", "fireChatDisabled", params, function (validated){
//     if(validated.success) {
//       serverLog(stateOfX.serverLogType.broadcast,"disableChat- " + JSON.stringify({channelId: params.channelId}));
//       params.channel.pushMessage('disableChat', {channelId: params.channelId})
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending player state broadcast - ' + JSON.stringify(validated))
//     }
//   });
// }

// ### Fire time bank timer start notification to players

// broadcastHandler.startTimeBank = function (params) {
//   keyValidator.validateKeySets("Request", "connector", "fireStartTimeBank", params, function (validated){
//     if(validated.success) {
//       var data =  _.omit(params, 'channel');
//       serverLog(stateOfX.serverLogType.broadcast,"startTimeBank- " + JSON.stringify(_.omit(params, 'channel')));
//       params.channel.pushMessage('startTimeBank', data)
//       videoHandler.createVideo({roundId: params.channel.roundId, channelId: params.channel.channelId, type: stateOfX.videoLogEventType.broadcast, data: data}, function(res){});
//     } else {
//       serverLog(stateOfX.serverLogType.error, 'Error while sending start timebank broadcast - ' + JSON.stringify(validated))
//     }
//   });
// }

// ### Broadcast to each binded session
broadcastHandler.fireBroadcastToAllSessions = function (params) {
  console.log("in fireBroadcastToAllSessions............. ", params);
  keyValidator.validateKeySets("Request", "connector", "fireBroadcastToAllSessions", params, function (validated){
    if(validated.success) {
      pomelo.app.get('channelService').broadcast(pomelo.app.get('frontendType'), params.route, params.data);
      // params.app.sessionService.forEachBindedSession(function(session) {
      //   broadcastHandler.sendMessageToUser({self: {app: params.app}, playerId: session.uid, msg: params.data, route: params.route});
      // });
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending broadcast to each sessions - ' + JSON.stringify(validated));
    }
  });
};

///////////////////////////////////////////////////////////////////
// General broadcast function to broadcast data on channel level //
///////////////////////////////////////////////////////////////////
// deprecated here
broadcastHandler.fireChannelBroadcast = function (params) {
  keyValidator.validateKeySets("Request", "connector", "fireChannelBroadcast", params, function (validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.broadcast, params.route + ": " + JSON.stringify(params.data));
      params.channel.pushMessage(params.route, params.data);
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending broadcast  on channel level - ' + JSON.stringify(validated));
    }
  });
};

//This function is used to send broadcast on blind level update
// tournament
broadcastHandler.updateBlind = function (params) {
  keyValidator.validateKeySets("Request", "connector", "updateBlind", params, function (validated){
    if(validated.success) {
      params.channel.pushMessage("updateBlind", params.data);
      console.log("updateBlind broadcast key validated successfully");
      //cb({success: true});
    } else {
      console.log("updatedBlind broadcast key validation unsuccessfull");
      //cb(validated);
    }
  });
};

module.exports = broadcastHandler;
