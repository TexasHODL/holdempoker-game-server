/*jshint node: true */
"use strict";

// This file is used to handle all the broadcasts
// > Event broadcast handler
// > Request from different events in Game
// > Broadcasts can be sent to channel level or player level

// ### External files and packages declaration ###
var _                     = require('underscore'),
    async                 = require("async"),
    keyValidator          = require("../../../../../shared/keysDictionary"),
    stateOfX              = require("../../../../../shared/stateOfX.js"),
    zmqPublish            = require("../../../../../shared/infoPublisher.js")

const configConstants = require('../../../../../shared/configConstants');

function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'ofcBroadcastHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}
// var ofcBroadcastHandler = {};
function ofcBroadcastHandler() {}
var pomelo = require('pomelo');
// ### Internal function to broadcast a single player through entryRemote.js function
ofcBroadcastHandler.sendMessageToUser = function (params) {
   keyValidator.validateKeySets('Request', 'connector', "sendMessageToUser", params, function (validated){
    if(validated.success) {
      pomelo.app.rpcInvoke(pomelo.app.get('serverId'), {namespace: "user", service: "entryRemote", method: "sendMessageToUser", args: [params.playerId, params.msg, params.route]}, function(data){
        // broadcast('broadcastName - ' + JSON.stringify(params.msg));
        serverLog(stateOfX.serverLogType.broadcast, params.route + ' - '+ JSON.stringify(params.msg));

        serverLog(stateOfX.serverLogType.info, 'Response from sending broadcast to individual user for - ' + params.route + ' - ' + JSON.stringify(data));
      });
    } else {
      serverLog(stateOfX.serverLogType.error, 'Key validation failed - ' + JSON.stringify(validated));
    }
  });
};

// ### Broadcast OFC sit of this player

ofcBroadcastHandler.fireOFCsitBroadcast = function (params) {
  keyValidator.validateKeySets('Request', 'connector', "fireOFCsitBroadcast", params, function (validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.broadcast, 'OFC sit- ' + JSON.stringify({channelId: params.channelId, playerId: params.player.playerId, points: params.player.points, seatIndex: params.player.seatIndex, playerName: params.player.playerName, imageAvtar: params.player.imageAvtar, state: params.player.state}));
      params.channel.pushMessage('sit', {channelId: params.channelId, playerId: params.player.playerId, points: params.player.points, seatIndex: params.player.seatIndex, playerName: params.player.playerName, imageAvtar: params.player.imageAvtar, state: params.player.state});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending sit broadcast - ' + JSON.stringify(validated));
    }
  });
};

// ### Broadcast OFC sit of this player

ofcBroadcastHandler.fireOFCgamePlayersBroadcast = function (params) {
  keyValidator.validateKeySets('Request', 'connector', "fireOFCgamePlayersBroadcast", params, function (validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.broadcast, "OFC gamePlayers- " + JSON.stringify({channelId: params.channelId, players: _.map(params.players,function(player){return _.pick(player,'playerId','points','state');}), removed: params.removed}));
      params.channel.pushMessage("gamePlayers", {channelId: params.channelId, players: _.map(params.players,function(player){return _.pick(player,'playerId','points','state', 'isInFantasyLand');}), removed: params.removed});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending game players broadcast - ' + JSON.stringify(validated));
    }
  });
};

// ### Broadcast into channel to start OFC game

ofcBroadcastHandler.fireOFCstartGameBroadcast = function (params, cb) {
  keyValidator.validateKeySets('Request', 'connector', "fireOFCstartGameBroadcast", params, function (validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.broadcast, "OFC startGame- " + JSON.stringify({channelId: params.channelId, dealerIndex: params.dealerIndex, currentMoveIndex: params.currentMoveIndex, state: params.state, roundName: params.roundName}));
      params.channel.pushMessage("startGame", {channelId: params.channelId, dealerIndex: params.dealerIndex, currentMoveIndex: params.currentMoveIndex, state: params.state, roundName: params.roundName});
      cb({success: true, channelId: params.channelId, info: "Start Game broadcast for OFC sent successfully."});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending start game broadcast - ' + JSON.stringify(validated));
      cb(validated);
    }
  });
};

//### Send individual player cards

ofcBroadcastHandler.fireOFCplayerCards = function(params, cb) {
  keyValidator.validateKeySets('Request', 'connector', "fireOFCplayerCards", params, function (validated) {
    if(validated.success) {
      serverLog(stateOfX.serverLogType.info, 'About to send player cards broadcast on player level.');
      serverLog(stateOfX.serverLogType.broadcast, "playerCards - " + JSON.stringify({channelId: params.channelId, playerId: params.playerId, cards: params.cards}));
      ofcBroadcastHandler.sendMessageToUser({self: params.self, playerId: params.playerId, msg: {channelId: params.channelId, playerId: params.playerId, cards: params.cards}, route: "playerCards"});
      cb({success: true, channelId: params.channelId, info: "Player cards for OFC sent successfully."});
    } else {
      cb(validated);
    }
  });
};

//### Send individual player cards

ofcBroadcastHandler.fireOFCfirstRoundCards = function(params, cb) {
  keyValidator.validateKeySets('Request', 'connector', "fireOFCfirstRoundCards", params, function (validated) {
    if(validated.success) {
      serverLog(stateOfX.serverLogType.info, 'About to send player cards broadcast on channel level.');
      serverLog(stateOfX.serverLogType.broadcast, "ofcFirstRoundCards - " + JSON.stringify({channelId: params.channelId, playerId: params.playerId, cards: params.cards}));
      params.channel.pushMessage("ofcFirstRoundCards", {channelId: params.channelId, playerId: params.playerId, cards: params.cards});
      cb({success: true, channelId: params.channelId, info: "Player cards for OFC for first round sent successfully."});
    } else {
      cb(validated);
    }
  });
};

// ### Broadcast after an action performed in OFC

ofcBroadcastHandler.fireOFCTurnBroadcast = function (params, cb) {
  keyValidator.validateKeySets("Request", "connector", "fireOFCTurnBroadcast", params, function (validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.broadcast,"OFC turn - " + JSON.stringify(_.omit(params, 'channel')));
      params.channel.pushMessage("turn", _.omit(params, 'channel'));
      cb({success: true});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending on turn broadcast - ' + JSON.stringify(validated));
      cb({success: false, info: 'Error while sending on turn broadcast - ' + JSON.stringify(validated)});
    }
  });
};

// ### OFC Game over broadcast to table

ofcBroadcastHandler.fireOFCgameOverBroadcast = function (params) {
  keyValidator.validateKeySets("Request", "connector", "fireOFCgameOverBroadcast", params, function (validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.broadcast,"OFC gameOver- " + JSON.stringify(_.omit(params, 'channel')));
      setTimeout(function(){
        params.channel.pushMessage("gameOver", _.omit(params, 'channel'));
      }, parseInt(configConstants.ofcOverBroadcastDelay)*1000);
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending game over broadcast - ' + JSON.stringify(validated));
    }
  });
};

// ### Send individual player cards already set along with discarded
// In order to handle client view

ofcBroadcastHandler.fireOFCplayerCardForView = function(params, cb) {
  keyValidator.validateKeySets('Request', 'connector', "fireOFCplayerCardForView", params, function (validated) {
    if(validated.success) {
      serverLog(stateOfX.serverLogType.broadcast, "fireOFCplayerCardForView - " + JSON.stringify({channelId: params.channelId, playerId: params.playerId, cards: params.cards}));
      ofcBroadcastHandler.sendMessageToUser({self: params.self, playerId: params.playerId, msg: {channelId: params.channelId, playerId: params.playerId, cards: params.cards, discarded: params.discarded}, route: "ofcPlayerCardsView"});
      cb({success: true, channelId: params.channelId, info: "Player cards for OFC sent successfully."});
    } else {
      cb(validated);
    }
  });
};

// ### Leave barodcast to channel in OFC table

ofcBroadcastHandler.fireOFCleaveBroadcast = function (params) {
  keyValidator.validateKeySets("Request", "connector", "fireOFCleaveBroadcast", params, function (validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.broadcast, "OFC leave- " + JSON.stringify(params.data));
      params.channel.pushMessage("leave", params.data);
      serverLog(stateOfX.serverLogType.info, '----- Leave Broadcast Fired --------');
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending OFC leave broadcast - ' + JSON.stringify(validated));
    }
  });
};

// General info broadcast to client (player level) in OFC

ofcBroadcastHandler.fireInfoBroadcastToPlayer = function (params) {
  keyValidator.validateKeySets("Request", "connector", "fireInfoBroadcastToPlayer", params, function (validated){
    if(validated.success) {
      ofcBroadcastHandler.sendMessageToUser({self: params.self, playerId: params.playerId, msg: {heading: params.heading, info: params.info, channelId: params.channelId, playerId: params.playerId, buttonCode: params.buttonCode}, route: "playerInfo"});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending info broadcast to player - ' + JSON.stringify(validated));
    }
  });
};

// ### Send player broadcast in order to display buyin popup in OFC table
// > In cases when player perform events when bankrupt in OFC table

ofcBroadcastHandler.fireBankruptBroadcast = function (params) {
  keyValidator.validateKeySets("Request", "connector", "fireBankruptBroadcast", params, function (validated){
    if(validated.success) {
      ofcBroadcastHandler.sendMessageToUser({self: params.self, playerId: params.playerId, msg: {channelId: params.channelId, playerId: params.playerId}, route: "bankrupt"});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending player state broadcast - ' + JSON.stringify(validated));
    }
  });
};

// Display updated player points on table to all players

ofcBroadcastHandler.ofcFirePlayerPointsBroadcast = function (params) {
  keyValidator.validateKeySets("Request", "connector", "ofcFirePlayerPointsBroadcast", params, function (validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.broadcast,"OFC playerCoins - " + JSON.stringify({channelId: params.channelId, playerId: params.playerId, amount: params.amount}));
      params.channel.pushMessage("playerCoins", {channelId: params.channelId, playerId: params.playerId, amount: params.amount});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending player state broadcast - ' + JSON.stringify(validated));
    }
  });
};

// ### Player state broadcast to channel level

ofcBroadcastHandler.ofcFirePlayerStateBroadcast = function (params) {
  keyValidator.validateKeySets("Request", "connector", "ofcFirePlayerStateBroadcast", params, function (validated){
    if(validated.success) {
      serverLog(stateOfX.serverLogType.broadcast,"OFC playerState - " + JSON.stringify({channelId: params.channelId, playerId: params.playerId, state: params.state}));
      params.channel.pushMessage('playerState', {channelId: params.channelId, playerId: params.playerId, state: params.state});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending player state broadcast - ' + JSON.stringify(validated));
    }
  });
};

// ### Broadcast for client-server connection for OFC

ofcBroadcastHandler.fireAckBroadcast = function (params) {
  keyValidator.validateKeySets("Request", "connector", "fireAckBroadcast", params, function (validated){
    if(validated.success) {
      ofcBroadcastHandler.sendMessageToUser({self: params.self, playerId: params.playerId, msg: {channelId: params.channelId, playerId: params.playerId}, route: "connectionAck"});
    } else {
      serverLog(stateOfX.serverLogType.error, 'Error while sending ack broadcast - ' + JSON.stringify(validated));
    }
  });
};

module.exports = ofcBroadcastHandler;