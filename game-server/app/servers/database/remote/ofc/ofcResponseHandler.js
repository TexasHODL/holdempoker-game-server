/*jshint node: true */
"use strict";

/**
 * Created by Amrendra on 2/08/2016.
**/
var _                        = require('underscore'),
    _ld                      = require('lodash'),
    async                    = require("async"),
    stateOfX                 = require("../../../../../shared/stateOfX"),
    zmqPublish               = require("../../../../../shared/infoPublisher"),
    tableManager             = require('./ofcTableManager'),
    ofcRemoteResponseHandler = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'responseHandler';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// Generate response for any action performed
// > It also includes the LEAVE and STANDUP as well
// > Considering all these cases can transfer turn, finish round or even Game as well

ofcRemoteResponseHandler.setActionKeys = function(params, cb) {
  var res = {};
  serverLog(stateOfX.serverLogType.info, '==== DATA IN CREATE RESPONSE setActionKeys ====');
  serverLog(stateOfX.serverLogType.info, 'Data - ' + JSON.stringify(params.data));
  
  res.success                       = true;
  res.isGameOver                    = params.data.isGameOver;
  res.table                         = params.table;
  res.data                          = params.data;
  res.data.success                  = true;
  res.data.currentPlayerId          = params.data.isGameOver ? "" : params.table.players[params.table.currentMoveIndex].playerId;
  res.data.currentPlayerRoundName   = params.data.isGameOver ? "" : params.table.players[params.table.currentMoveIndex].roundName;
  res.data.currentPlayerCards       = params.data.isGameOver ? "" : params.table.players[params.table.currentMoveIndex].cards;
  res.data.response                 = {};
  res.data.response.success         = true;
  res.data.response.channelId       = params.data.channelId;
  res.data.response.isGameOver      = params.data.isGameOver;
  res.data.response.isRoundOver     = params.data.roundOver;
  res.data.response.tournamentRules = params.table.tournamentRules;
  res.data.response.channelType     = params.table.channelType;
  res.data.response.isCurrentPlayer = params.data.isCurrentPlayer;
  res.data.response.preRoundName    = params.data.preRoundName;

  // Add following keys only in case of leave or standup
  if(params.data.action === stateOfX.move.standup || params.data.action === stateOfX.move.leave){
    res.data.response.broadcast = {
      success     : true,
      channelId   : params.data.channelId,
      playerId    : params.data.playerId,
      playerName  : params.data.playerName
    };
  }

  // Add turn broadcast data
  res.data.response.turn = {
    success             : true,
    channelId           : params.data.channelId,
    playerId            : params.data.playerId,
    playerName          : params.data.playerName,
    action              : params.data.action,
    cards               : params.data.cards,
    royalities          : !!params.table.players[params.data.index] ? params.table.players[params.data.index].royalities : {top: -1, middle: -1, bottom: -1},
    royalitiesSet       : !!params.table.players[params.data.index] ? params.table.players[params.data.index].royalitiesSet : {top: false, middle: false, bottom: false},
    roundName           : params.data.roundName,
    currentMoveIndex    : params.data.isGameOver ? "" : !!params.table.players[params.table.currentMoveIndex] ? params.table.players[params.table.currentMoveIndex].seatIndex : -1
  };

  // Add Game over broadcast
  res.data.response.over = {
    success      	: true,
    channelId    	: params.data.channelId,
    endingType   	: stateOfX.endingType.gameComplete,
    winners      	: params.data.winners,
    rakeDeducted 	: params.data.rakeDeducted,
  };

  // Current card assigned to current player with move
  res.data.response.currentCards    = params.data.isGameOver ? "" : !!params.table.players[params.table.currentMoveIndex] ? params.table.players[params.table.currentMoveIndex].currentCards : {top: [], middle: [], bottom: []};
  res.data.response.currentPlayerId = params.data.isGameOver ? "" : !!params.table.players[params.table.currentMoveIndex] ? params.table.players[params.table.currentMoveIndex].playerId : "";
  res.data.response.currentPlayerRoundName = params.data.isGameOver ? "" : !!params.table.players[params.table.currentMoveIndex] ? params.table.players[params.table.currentMoveIndex].roundName : "";

  serverLog(stateOfX.serverLogType.info, '==== FINALE RESPONSE ====');
  params = res;
  serverLog(stateOfX.serverLogType.info, 'Action response keys - ' + _.keys(res));
  cb(res);
};

// Generate response for Game start broadcast
ofcRemoteResponseHandler.setGameStartKeys = function(params, cb) {
  var res     = {};
  res.success = true;
  serverLog(stateOfX.serverLogType.info, 'on Game Start Actual pot - ' + tableManager.getTotalPot(params.table.pot));
  serverLog(stateOfX.serverLogType.info, 'on Game Start Round bets - ' + params.table.roundBets);
  serverLog(stateOfX.serverLogType.info, 'on Game Start Dead amount - ' + tableManager.getTotalBet(params.table.roundBets));
  res.config  = {
    channelId         : params.channelId,
    dealerIndex       : params.table.dealerSeatIndex,
    smallBlindIndex   : params.table.smallBlindSeatIndex,
    bigBlindIndex     : params.table.players[params.table.bigBlindIndex].seatIndex,
    straddleIndex     : params.table.straddleIndex > -1 ? params.table.players[params.table.straddleIndex].seatIndex : -1,
    currentMoveIndex  : params.table.players[params.table.currentMoveIndex].seatIndex,
    moves             : params.table.players[params.table.currentMoveIndex].moves,
    smallBlind        : params.table.smallBlindIndex >= 0 ? params.table.roundBets[params.table.smallBlindIndex] : 0,
    bigBlind          : params.table.roundBets[params.table.bigBlindIndex],
    pot               : _.pluck(params.table.pot, 'amount'),
    roundMaxBet       : params.table.roundMaxBet,
    state             : params.table.state,
    roundName         : params.table.roundName,
    minRaiseAmount    : params.table.minRaiseAmount,
    maxRaiseAmount    : params.table.maxRaiseAmount,
    totalPot          : tableManager.getTotalPot(params.table.pot) + tableManager.getTotalBet(params.table.roundBets)
  };

  res.eventDetails    = {
    players           : _.where(params.table.players, {state: stateOfX.playerState.playing}),
    blindDetails      : {
      isStraddle            : params.table.straddleIndex >= 0,
      smallBlindPlayerName  : params.table.smallBlindIndex >= 0 ? params.table.players[params.table.smallBlindIndex].playerName : "No SB",
      bigBlindPlayerName    : params.table.players[params.table.bigBlindIndex].playerName,
      straddlePlayerName    : params.table.straddleIndex > -1 ? params.table.players[params.table.straddleIndex].playerName : "",
      smallBlind            : params.table.smallBlindIndex >= 0 ? params.table.roundBets[params.table.smallBlindIndex] : 0,
      bigBlind              : params.table.roundBets[params.table.bigBlindIndex],
      straddle              : params.table.straddleIndex > -1 ? params.table.roundBets[params.table.straddleIndex] : -1
    },
    tableDetails      : {
      channelVariation: params.table.channelVariation,
      isPotLimit      : params.table.isPotLimit,
      isRealMoney     : params.table.isRealMoney,
      channelName     : params.table.channelName,
      smallBlind      : params.table.smallBlind,
      bigBlind        : params.table.bigBlind,
      dealerSeatIndex : params.table.dealerSeatIndex
    }
  };
  cb(res);
};

// Generate blind deduction response for broadcast
ofcRemoteResponseHandler.setDeductBlindKeys = function(params, cb) {
  var res     = {};
  res.success = true;
  res.table   = params.table;
  res.data    = {
    success         : true,
    channelId       : params.channelId,
    smallBlindChips : params.table.smallBlindIndex >= 0 ? params.table.players[params.table.smallBlindIndex].chips : 0,
    bigBlindChips   : params.table.players[params.table.bigBlindIndex].chips,
    straddleChips   : params.table.straddleIndex >= 0 ? params.table.players[params.table.straddleIndex].chips : -1,
    smallBlindIndex : params.table.smallBlindSeatIndex,
    bigBlindIndex   : params.table.players[params.table.bigBlindIndex].seatIndex,
    straddleIndex   : params.table.straddleIndex >= 0 ? params.table.players[params.table.straddleIndex].seatIndex : -1,
    smallBlind      : params.table.smallBlindIndex >= 0 ? params.table.roundBets[params.table.smallBlindIndex] : 0,
    bigBlind        : params.table.roundBets[params.table.bigBlindIndex],
    pot             : _.pluck(params.table.pot, 'amount'),
    totalPot        : tableManager.getTotalPot(params.table.pot) + tableManager.getTotalBet(params.table.roundBets),
    moves           : params.table.players[params.table.currentMoveIndex].moves,
    forceBlind      : params.data.forceBlind
  };
  cb(res);
};

// Generate table view on client request from lobby

ofcRemoteResponseHandler.setTableViewKeys = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'Table while setting setTableViewKeys - ' + JSON.stringify(params));
  var res                 = {};
  res.success             = true;
  res.channelId           = params.channelId;
  res.isTableFull         = (!!params.table && !!params.table.players && !!params.table.queueList) && (params.table.players.length + params.table.queueList.length >= params.table.maxPlayers);
  res.isJoinedWaitingList = (!!params.table && !!params.table.players && !!params.table.queueList) && (_ld.findIndex(params.table.queueList, params.playerId) >= 0);
  res.players             = [];

  if(!!params.table.players && params.table.players.length > 0) {
    async.each(params.table.players, function(player, ecb){
      res.players.push({
        playerName  : player.playerName,
        chips       : player.chips
      });
      ecb();
    }, function(err){
      cb(res);
    });
  } else {
    cb(res);
  }
};

module.exports = ofcRemoteResponseHandler;