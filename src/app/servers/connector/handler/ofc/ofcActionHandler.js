/*jshint node: true */
"use strict";

// This file is used to handle additional events for any action performed on table

var     _                  = require("underscore"),
    stateOfX               = require("../../../../../shared/stateOfX"),
    zmqPublish             = require("../../../../../shared/infoPublisher.js"),
    ofcBroadcastHandler    = require("./ofcBroadcastHandler"),
    ofcStartGameHandler    = require("./ofcStartGameHandler"),
    ofcActionLogger        = require("./ofcActionLogger"),
    ofcChannelTimerHandler = require("./ofcChannelTimerHandler");

const configConstants = require('../../../../../shared/configConstants');

function ofcActionHandler() {}

// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'ofcActionHandler';
  logObject.serverName   = stateOfX.serverType.database;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  zmqPublish.sendLogMessage(logObject);
}

function handleMoveAction(params, cb){
  // Fire current player cards to next player move
  if(!!params.response.data.response.currentCards && params.response.data.response.currentCards.length > 0) {
    serverLog(stateOfX.serverLogType.info, 'Round name for this player, for which cards are going to be sent - ' + JSON.stringify(params.response.data.response.preRoundName));
    if(params.response.data.response.preRoundName !== stateOfX.ofcRound.one) {
      ofcBroadcastHandler.fireOFCplayerCards({self: params.self, channelId: params.request.channelId, playerId: params.response.data.response.currentPlayerId, cards: params.response.data.response.currentCards}, function(playerCardResponse){
        if(playerCardResponse.success) {
          serverLog(stateOfX.serverLogType.info, 'Current card broadcast after turn - ' + JSON.stringify(playerCardResponse));
        } else {
          cb(playerCardResponse);
          return;
        }
      });
    } else {
      ofcBroadcastHandler.fireOFCfirstRoundCards({channel: params.channel, channelId: params.request.channelId, playerId: params.response.data.response.currentPlayerId, cards: params.response.data.response.currentCards}, function(ofcPlayerCardsResponse){
        if(ofcPlayerCardsResponse.success){
          serverLog(stateOfX.serverLogType.info, 'Current card broadcast after turn - ' + JSON.stringify(ofcPlayerCardsResponse));
        } else {
          cb(ofcPlayerCardsResponse);
          return;
        }
      });
    }
  }

  // Fire turn broadcast if action performed by current player with move
  setTimeout(function(){
    if(params.response.data.isCurrentPlayer) {
      params.response.data.response.turn.channel     = params.channel;
      params.response.data.response.turn.isRequested = params.request.isRequested;
      ofcBroadcastHandler.fireOFCTurnBroadcast(params.response.data.response.turn, function(fireOnTurnBroadcastResponse){
        if(fireOnTurnBroadcastResponse.success) {
          ofcActionLogger.createEventLog ({self: params.self, session: params.session, channel: params.channel, data: {channelId: params.request.channelId, eventName: stateOfX.logEvents.playerTurn, rawData: {playerName: params.response.data.response.turn.playerName, cards: params.response.data.response.turn.cards, royalities: params.response.data.response.turn.royalities}}});
          ofcActionLogger.createEventLog ({self: params.self, session: params.session, channel: params.channel, data: {channelId: params.request.channelId, eventName: stateOfX.logEvents.playerRoyality, rawData: {playerId: params.request.playerId, playerName: params.response.data.response.turn.playerName, royalitiesSet: params.response.data.response.turn.royalitiesSet, royalities: params.response.data.response.turn.royalities}}});
          if(!params.response.data.isGameOver) {
            params.data                       = params.response.data;
            params.channelId                  = params.request.channelId;
            params.response.data.currentCards = params.response.data.response.currentCards;
            ofcChannelTimerHandler.ofcStartTurnTimeOut(params);
          } else {
            serverLog(stateOfX.serverLogType.error, 'Not starting channel turn timer and resetting previous ones as Game is over now!');
            ofcChannelTimerHandler.ofcKillChannelTurnTimer({channel: params.channel});
          }
        } else {
          serverLog(stateOfX.serverLogType.error, 'Unable to broadcast turn, in Game start auto turn condition!');
        }
      });
    }
  }, parseInt(configConstants.ofcTurnCardBroadcastDelay)*500);

  // IN CASE OF LEAVE/STANDUP ACTION ONLY
  // fire relevant broadcast
  if(!!params.response.data.response.broadcast) {
    serverLog(stateOfX.serverLogType.info, 'About to send leave broadcast in OFC.');
  	// ofcBroadcastHandler.fireOFCleaveBroadcast({channel: params.channel, data: params.response.data.response.broadcast});
    ofcBroadcastHandler.ofcFirePlayerStateBroadcast({channel: params.channel, playerId: params.request.playerId, channelId: params.request.channelId, state: stateOfX.playerState.surrender});
  }

  // Fire game over broadcast
  if(params.response.data.response.isGameOver) {
    ofcActionLogger.createEventLog ({self: params.self, session: params.session, channel: params.channel, data: {channelId: params.request.channelId, eventName: stateOfX.logEvents.gameOver, rawData: params.response.data.response.over}});
    // ofcActionLogger.createEventLog ({self: params.self, session: params.session, channel: params.channel, data: {channelId: params.request.channelId, eventName: stateOfX.logEvents.summary, rawData: params.response.data.response.over}});
    params.response.data.response.over.channel = params.channel;
    ofcBroadcastHandler.fireOFCgameOverBroadcast(params.response.data.response.over);
    setTimeout(function(){
      serverLog(stateOfX.serverLogType.info, 'About to start game after player action Game Over event in ' + (configConstants.deleayInOFCgames) + ' seconds.');
      ofcStartGameHandler.ofcStartGame({self: params.self, session: params.session, channelId: params.request.channelId, channel: params.channel, eventName: stateOfX.OFCstartGameEvent.gameOver});
    }, parseInt(configConstants.deleayInOFCgames)*1000);
  }
  cb({success: true, channelId: params.request.channelId, info: "Additional action handled for " + params.eventName + " successfully."});
}

// ### Perform action on move fail

function handleMoveFailAction (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Response data while move action failed addition action to perform - ' + JSON.stringify(params.response));
  ofcBroadcastHandler.fireOFCplayerCardForView({self: params.self, channelId: params.request.channelId, playerId: params.response.data.playerId, cards: params.response.data.cards, discarded: params.response.data.discarded} , function(playerCardsViewResponse){
    if(playerCardsViewResponse.success) {
      cb({success: true, channelId: params.response.data.channelId, info: "Player card for view broadcast successfully."});
    } else {
      cb(playerCardsViewResponse);
    }
  });
}

// Handle additional cases or actions for auto sit

function handleAutoSitAction (params, cb) {
  ofcActionLogger.createEventLog ({self: params.self, session: params.session, channel: params.channel, data: {channelId: params.request.channelId, eventName: stateOfX.logEvents.reserved, rawData: {playerName: params.response.player.playerName, points: params.response.player.points, seatIndex: params.response.data.seatIndex}}});
  ofcBroadcastHandler.fireOFCsitBroadcast({self: params.self, channel: params.channel, channelId: params.request.channelId, player: params.response.player});
  ofcBroadcastHandler.fireBankruptBroadcast({self: params.self, playerId: params.request.playerId, channelId: params.request.channelId});
  ofcChannelTimerHandler.ofcVacantReserveSeat({self: params.self, channel: params.channel, channelId: params.request.channelId, playerId: params.request.playerId, playerName: params.request.playerName});
  cb({success: true, channelId: params.request.channelId, info: "Additional action handled for " + params.eventName + " successfully."});
}

// Perform additional actions after adding successful poitns on table

function handleAddPointsAction (params, cb) {
  params.response.channel = params.channel;
  ofcBroadcastHandler.ofcFirePlayerPointsBroadcast(params.response);
  ofcStartGameHandler.ofcStartGame({self: params.self, session: params.session, channelId: params.request.channelId, channel: params.channel, eventName: stateOfX.OFCstartGameEvent.addPoints});
  ofcChannelTimerHandler.ofcKillReserveSeatReferennce({playerId: params.request.playerId, channel: params.channel});
  ofcBroadcastHandler.ofcFirePlayerStateBroadcast({self: params.self, channel: params.channel, playerId: params.request.playerId, channelId: params.request.channelId, state: params.response.state});
  cb({success: true, channelId: params.request.channelId, info: "Additional action handled for " + params.eventName + " successfully."});
}

// ### Handle additional operations on player sit success events

function handleSitSuccessAction (params, cb) {
  ofcActionLogger.createEventLog ({self: params.self, session: params.session, channel: params.channel, data: {channelId: params.request.channelId, eventName: stateOfX.logEvents.sit, rawData: {playerName: params.response.player.playerName, points: params.response.player.points}}});
  cb({success: true, channelId: params.request.channelId, info: "Additional action handled for " + params.eventName + " successfully."});
}

// Handle request and process additional cases after client request
// for different events

ofcActionHandler.handleAction = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'Action handler params keys - ' + JSON.stringify(_.keys(params)));
	switch(params.eventName)
  {
    case stateOfX.OFCevents.makeMoveSuccess     : handleMoveAction(params, function (handleEventResponse){cb(handleEventResponse);}); break;
    case stateOfX.OFCevents.makeMoveSuccessFail : handleMoveFailAction(params, function (handleEventResponse){cb(handleEventResponse);}); break;
    case stateOfX.OFCevents.leaveSuccess        : handleMoveAction(params, function (handleEventResponse){cb(handleEventResponse);}); break;
    case stateOfX.OFCevents.autositSuccess      : handleAutoSitAction(params, function (handleEventResponse){cb(handleEventResponse);}); break;
    case stateOfX.OFCevents.addpointSuccess     : handleAddPointsAction(params, function (handleEventResponse){cb(handleEventResponse);}); break;
    case stateOfX.OFCevents.sitSuccess          : handleSitSuccessAction(params, function (handleEventResponse){cb(handleEventResponse);}); break;

    default: serverLog(stateOfX.serverLogType.warning, 'No additional handler for this event written.'); cb({success: false, info: 'No additional handler for this event written.'}); break;
  }
};

module.exports = ofcActionHandler;
