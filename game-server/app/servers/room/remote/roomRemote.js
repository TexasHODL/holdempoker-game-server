/*
* @Author: sushiljainam
* @Date:   2017-06-19 15:10:39
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-28 15:21:42
*/

/*jshint node: true */
"use strict";

var _ = require('underscore');
var stateOfX = require("../../../../shared/stateOfX.js");
var popupTextManager = require("../../../../shared/popupTextManager.js");
var broadcastHandler = require("../roomHandler/broadcastHandler.js");


module.exports = function (app) {
	return new RoomRemote(app);
};

var serverLog = console.log.bind(console, __filename);

function RoomRemote(app){
	this.app = app;
  this.channelHandler = require("../handler/channelHandler")(app);
}

// hit auto leave by rpc
// when removing player
RoomRemote.prototype.leaveRoom = function(msg, cb) {
	console.log(msg);
	this.channelHandler.leaveTable(msg, 'session', function(err, res){
		console.log('leave - auto called', err, res);
		cb(null, res);
	});
};

// auto remove from queue by rpc
RoomRemote.prototype.leaveWaitingList = function(msg, cb) {
	console.trace(msg);
	console.log(msg);
	this.channelHandler.leaveWaitingList(Object.assign({isRequested: false, playerName: 'A player'}, msg), 'session', function (err, res) {
		console.log('leaveWaitingList - auto called', err, res);
		cb(null, res);
	});
};

//{ playerId: '593645984d9cb91e510b3deb', sessionId: '593645984d9cb91e510b3deb-5sw6D5igLwx5ErvxS2UD', channelId: '59368186a5f6ef427ab59c64', isStandUp: false, playerName: 'D6bpbpN2hV', isRequested: false }

// handle player disconnection for every room
RoomRemote.prototype.handleDisconnection = function(msg, cb) {
	var self = this;
	// via - database tableRemote (may be - only last one)
	// if player is sit
	// if player is waiting - RUN sitout next hand (direct or indirect)
	// if player is playing - change state DISCONNECTED - room broadcast
	if (msg.channelId && msg.playerId) {
		this.app.rpc.database.tableRemote.handleDisconnection({}, {channelId: msg.channelId, playerId: msg.playerId}, function (response) {
			// console.error('response from tableRemote.handleDisconnection', response);
			if (response.success) {
				var channel = self.app.get('channelService').getChannel(msg.channelId, false);
				if (response.data.state && channel) {
					broadcastHandler.firePlayerStateBroadcast({channel: channel, self: self.channelHandler, playerId: msg.playerId, channelId: msg.channelId, state: response.data.state});
				}
				cb({success: true});
			} else {
				cb({success: true});
			}
		});
	} else {
		cb({success: false, info: 'request data insufficient - handleDisconnection'});
	}
};

// fire player chips in table at lobby view
var firePlayerChipsLobbyBroadcast = function(app, channelId, channelType, players) {
  for (var i = 0; i < players.length; i++) {
    broadcastHandler.fireBroadcastToAllSessions({app: app, data: {_id: channelId, playerId: players[i].playerId, updated: {playerName: players[i].playerName, chips: players[i].chips}, channelType: channelType, event: stateOfX.recordChange.tableViewChipsUpdate}, route: stateOfX.broadcasts.tournamentLobby});
  }
};

// game players broadcsat from start player
// by database server
RoomRemote.prototype.sg_gamePlayersBrd = function(params, cb) {
	params.self = this.channelHandler;
	serverLog(JSON.stringify(params.data));
  serverLog(stateOfX.serverLogType.info, 'In startGameHandler function fireGamePlayersBroadcast ! - ' + _.keys(params));
	params.channel = params.self.app.get("channelService").getChannel(params.channelId);
	params.eventName = params.channel.gameStartEventName;
	// params.data.preGameState = params.data.data.preGameState;
	// params.data.startGame = params.data.data.startGame;
	// params.data.players = params.data.data.players;
	// params.data.removed = params.data.data.removed;

  // Broadcast game players with state (Do not send when a game is running)
  if(!params.eventName) {
    cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManager.falseMessages.FIREGAMEPLAYERSBROADCASTFAIL_STARTGAMEHANDLER});
    //cb({success: false, channelId: params.channelId, info: "Missing event name while starting Game!"});
    return false;
  }

  serverLog(stateOfX.serverLogType.info, 'The game will start from event - ' + params.eventName);
  serverLog(stateOfX.serverLogType.info, 'Previous Game state of this table - ' + params.data.preGameState);


  // Do not process Game player broadcast if Game is already running on this table
  if(params.data.preGameState !== stateOfX.gameState.idle) {
    serverLog(stateOfX.serverLogType.info, 'Previous Game state is not IDLE so avoiding Game Players broadcast to be fired!');
    cb(null, _.omit(params, 'self', 'channel'));
    return false;
  }

  // Process if game is going to start
  if(params.data.startGame) {
    params.channel.gameStartEventSet = stateOfX.startGameEventOnChannel.running;
    serverLog(stateOfX.serverLogType.info, 'Sending Game Players: Game is not running on this table, and Game is going to start!');
    if(params.channel.channelType === stateOfX.gameType.tournament) {
      serverLog(stateOfX.serverLogType.info, 'About to set ONBREAK for tournament sitout players');
      for (var i = 0; i < params.data.players.length; i++) {
        if(params.data.players[i].tournamentData.isTournamentSitout) {
          serverLog(stateOfX.serverLogType.info, 'Setting player ' + params.data.players[i].playerName + ' as ONBREAK.');
          params.data.players[i].state   = stateOfX.playerState.onBreak;
        }
      }
    }
    broadcastHandler.fireTablePlayersBroadcast({self: params.self, channelId: params.channelId, channel: params.channel, players: params.data.players, removed: params.data.removed});
    firePlayerChipsLobbyBroadcast(params.self.app, params.channelId, params.channel.channelType, params.data.players);
    //  serverLog(stateOfX.serverLogType.info,'params.channel in fireGamePlayersBroadcast - ', params.channel);
    cb(null, {success: true});
    return true;
  }

  // Process if game is not going to start
  serverLog(stateOfX.serverLogType.info, 'Sending Game Players: Game is not running on this table, and Game is not going to start!');
  params.channel.gameStartEventSet  = stateOfX.startGameEventOnChannel.idle;
  params.channel.gameStartEventName = null;
  params.channel.roundId            = "";
  broadcastHandler.fireTablePlayersBroadcast({self: params.self, channelId: params.channelId, channel: params.channel, players: params.data.players, removed: params.data.removed});
  firePlayerChipsLobbyBroadcast(params.self.app, params.channelId, params.channel.channelType, params.data.players);
  //  serverLog(stateOfX.serverLogType.info,'params.channel in fireGamePlayersBroadcast - ', params.channel);
  cb(null, {success: true});
  return true;
};

// RoomRemote.prototype.hitAutoSit = function(msg,session, cb) {
// 	// console.log("in room remote----------------",msg,session);
// 	// cb("in room remote--------------------");
// 	this.channelHandler.autoSit( msg,session, function(err, res){
// 		console.log('autoSit - auto called', err, res);
// 		cb(null, res);
// 	});
// };