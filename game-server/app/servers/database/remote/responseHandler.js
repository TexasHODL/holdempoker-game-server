/*jshint node: true */
"use strict";

/**
 * Created by Amrendra on 2/08/2016.
**/
var stateOfX            = require("../../../../shared/stateOfX"),
    _                   = require('underscore'),
    _ld                 = require('lodash'),
    async               = require("async"),
    zmqPublish          = require("../../../../shared/infoPublisher"),
    tableManager        = require("./tableManager"),
    createGameResponse  = {};

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

function changeFormat(cardsToShow){
  var arr = [];
  var x;
  for (x in cardsToShow) {
    arr.push({playerId: x, cards: cardsToShow[x]});
  }
  return arr;
}


// Generate response for any action performed
// > It also includes the LEAVE and STANDUP as well
// > Considering all these cases can transfer turn, finish round or even Game as well

createGameResponse.setActionKeys = function(params, cb) {
  var res = {};
  serverLog(stateOfX.serverLogType.info, '==== DATA IN CREATE RESPONSE setActionKeys ====');
  serverLog(stateOfX.serverLogType.info, 'Data is - ' + JSON.stringify(params.data));
  serverLog(stateOfX.serverLogType.info, "params.table is - " + JSON.stringify(params.table));

  res.success                       = true;
  res.isGameOver                    = params.data.isGameOver;
  res.table                         = params.table;
  res.data                          = params.data;
  res.data.success                  = true;
  res.data.response                 = {};
  res.data.response.success         = true;
  res.data.response.channelId       = params.data.channelId;
  res.data.response.channelType     = params.table.channelType;
  res.data.response.isGameOver      = params.data.isGameOver;
  res.data.response.loyalityList    = params.data.loyalityList;//key added for loyality broadcast (Rake)
  res.data.response.megaPointsResult= params.data.megaPointsResult; // mega points result OR undefined
  res.data.response.isCurrentPlayer = params.data.isCurrentPlayer;
  res.data.response.isRoundOver     = params.data.roundOver;
  res.data.response.playerLength    = params.table.players.length;

  // Send tournament rule and bounty winner only if tournament table
  if(params.table.channelType === stateOfX.gameType.tournament) {
    res.data.response.tournamentRules = params.table.tournamentRules;
    res.data.response.bountyWinner    = params.data.bountyWinner;
  }

  // Add following keys only in case of leave or standup
  if((params.data.action === stateOfX.move.standup || params.data.action === stateOfX.move.leave) && params.table.channelType === stateOfX.gameType.normal){
    res.data.response.isSeatsAvailable = params.table.maxPlayers !== params.table.players.length;
    res.data.response.broadcast = {
      success     : true,
      channelId   : params.data.channelId,
      playerId    : params.data.playerId,
      playerName  : params.data.playerName,
      isStandup   : params.data.action === stateOfX.move.standup
    };
    res.data.response.chips = {
      freeChips: params.data.freeChips,
      realChips: params.data.realChips
    };
  }

  // Add turn broadcast data
  res.data.response.turn = {
    success           : true,
    channelId         : params.data.channelId,
    runBy             : params.data.runBy || "none",
    playerId          : params.data.playerId,
    playerName        : params.data.playerName,
    amount            : params.data.amount,
    action            : (params.table.channelType === stateOfX.gameType.tournament && (params.data.action === stateOfX.move.standup || params.data.action === stateOfX.move.leave)) ? stateOfX.move.fold : params.data.action,
    chips             : params.data.chips,
    isRoundOver       : params.data.roundOver,
    roundName         : params.data.isGameOver ? stateOfX.round.showdown : params.table.roundName,
    pot               : _.pluck(params.table.pot, 'amount'),
    currentMoveIndex  : params.data.isGameOver ? "" : params.table.players[params.table.currentMoveIndex].seatIndex,
    moves             : params.data.isGameOver ? [] : params.table.players[params.table.currentMoveIndex].moves,
    totalRoundBet     : params.data.isGameOver || params.data.action === stateOfX.move.standup || params.data.action === stateOfX.move.leave  ? 0  : params.table.players[params.data.index].totalRoundBet,
    lastPlayerBet     : params.data.roundOver ? (params.data.action === stateOfX.move.standup || params.data.action === stateOfX.move.leave ? 0 : params.data.considerAmount) : 0,
    roundMaxBet       : params.table.roundMaxBet,
    minRaiseAmount    : params.table.minRaiseAmount,
    maxRaiseAmount    : params.table.maxRaiseAmount,
    totalPot          : tableManager.getTotalPot(params.table.pot) + tableManager.getTotalBet(params.table.roundBets)
  };

  // Add largest and smallest stack for tournament lobby
  res.data.response.largestStack  = _.max(params.table.players, function(player){ return player.chips; }).chips;
  res.data.response.smallestStack = _.min(params.table.players, function(player){ return player.chips; }).chips;

  // Add blind update details in case of tournament
  res.data.response.isBlindUpdated = !!params.data.isBlindUpdated ? params.data.isBlindUpdated : false;
  if(params.data.isBlindUpdated) {
    res.data.response.newBlinds = params.data.newBlinds;
  }

  // Add round over broadcast data
  res.data.response.round = {
    success   : true,
    channelId : params.data.channelId,
    roundName : params.data.isGameOver ? stateOfX.round.showdown : params.table.roundName,
    boardCard : params.data.currentBoardCard
  };

  // Add player per flop percent for lobby broadcast
  res.data.response.flopPercent = !!params.data.flopPercent ? parseInt(params.data.flopPercent) : -1;

  // Add Game over broadcast
  res.data.response.over = {
    success      	: true,
    channelId    	: params.data.channelId,
    endingType   	: !!params.data.endingType ? params.data.endingType : stateOfX.endingType.gameComplete,
    winners      	: params.data.winners,
    rakeDeducted 	: params.data.rakeDeducted,
    cardsToShow   : changeFormat(params.data.cardsToShow),
    chipsBroadcast: params.data.chipsBroadcast,
    addChipsFailed: params.data.addChipsFailed
  };

  // Add average pot for lobby broadcast
  res.data.response.avgPot = !!params.data.avgPot ? parseInt(params.data.avgPot) : -1;

  // Add precheck key
  res.data.response.preChecks = params.table.preChecks;

  // Add best hands in response
  res.data.response.bestHands = params.table.bestHands;

  serverLog(stateOfX.serverLogType.info, '==== FINALE RESPONSE ====');
  params = res;

  // Delete further unused keys
  delete params.data.cardsToShow;
  delete params.data.rakeDeducted;
  serverLog(stateOfX.serverLogType.info, _.keys(res));
  cb(res);
};

// Generate response for Game start broadcast
createGameResponse.setGameStartKeys = function(params, cb) {
  var res     = {};
  res.success = true;
  serverLog(stateOfX.serverLogType.info, 'on Game Start Actual pot - ' + tableManager.getTotalPot(params.table.pot));
  serverLog(stateOfX.serverLogType.info, 'on Game Start Round bets - ' + params.table.roundBets);
  serverLog(stateOfX.serverLogType.info, 'on Game Start Dead amount - ' + tableManager.getTotalBet(params.table.roundBets));
  res.config  = {
    channelId         : params.channelId,
    roundId           : params.table.roundId,
    roundNumber       : params.table.roundNumber,
    dealerIndex       : params.table.dealerSeatIndex,
    smallBlindIndex   : params.table.smallBlindSeatIndex,
    bigBlindIndex     : params.table.players[params.table.bigBlindIndex].seatIndex,
    straddleIndex     : params.table.straddleIndex > -1 ? params.table.players[params.table.straddleIndex].seatIndex : -1,
    currentMoveIndex  : params.table.players[params.table.currentMoveIndex].seatIndex,
    moves             : params.table.players[params.table.currentMoveIndex].moves,
    // smallBlind        : params.table.smallBlindIndex >= 0 ? params.table.roundBets[params.table.smallBlindIndex] : 0,
    smallBlind        : params.table.smallBlind,
    // bigBlind          : params.table.roundBets[params.table.bigBlindIndex],
    bigBlind          : params.table.bigBlind,
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
      smallBlindPlayerName  : params.table.smallBlindIndex >= 0 ? (params.table.players[params.table.smallBlindIndex]?params.table.players[params.table.smallBlindIndex].playerName:"No SB") : "No SB",
      bigBlindPlayerName    : (params.table.players[params.table.bigBlindIndex]?params.table.players[params.table.bigBlindIndex].playerName:""),
      straddlePlayerName    : params.table.straddleIndex > -1 ? (params.table.players[params.table.straddleIndex]?params.table.players[params.table.straddleIndex].playerName: "") : "",
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

  // Add removed players due to allowed BB passed
  // Adding code here as we are incrementing blind missed after game start
  // and when we are setting D/SB/BB players

  res.removed = [];
  async.each(params.table.players, function(player, ecb){
    serverLog(stateOfX.serverLogType.info, 'Cecking player for BB missed - ' + JSON.stringify(player));
    if(player.bigBlindMissed >= params.table.blindMissed) {
      serverLog(stateOfX.serverLogType.info, player.playerName + ' has crossed BB missed condition, storing details and will be removed later.');
      res.removed.push({
        playerId    : player.playerId,
        channelId   : params.channelId,
        isStandup   : true,
        isRequested : false,
        playerName  : player.playerName
      });
    } else {
      serverLog(stateOfX.serverLogType.info, player.playerName + ' hasnt crossed BB missed allowed condition!');
    }
    ecb();
  }, function(err) {
    if(!err) {
      cb(res);
    } else {
      cb({success: false, channelId: params.channelId, info: "Unable to process BB missed players details!", isRetry: false, isDisplay: false});
    }
  });
};

/////////////////////////////////////////////////////
// Generate blind deduction response for broadcast //
/////////////////////////////////////////////////////
createGameResponse.setDeductBlindKeys = function(params, cb) {
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
    forceBlind      : params.data.forceBlind,
    tableSmallBlind : params.table.smallBlind,
    tableBigBlind   : params.table.bigBlind
  };
  cb(res);
};

//////////////////////////////////////////////////////
// Generate table view on client request from lobby //
//////////////////////////////////////////////////////
createGameResponse.setTableViewKeys = function(params, cb) {
  // console.log("Table while setting setTableViewKeys---"+ JSON.stringify(params))
  serverLog(stateOfX.serverLogType.info, 'Table while setting setTableViewKeys - ' + JSON.stringify(params.table.queueList));
  var res                 = {};
  res.success             = true;
  res.channelId           = params.channelId;
  res.isTableFull         = (!!params.table && !!params.table.players && !!params.table.queueList) && (params.table.players.length + params.table.queueList.length >= params.table.maxPlayers);
  res.isJoinedWaitingList = (!!params.table && !!params.table.queueList) && (_ld.findIndex(params.table.queueList, {playerId: params.playerId}) >= 0);
  res.isAlreadyPlaying    = (!!params.table && !!params.table.players) && (_ld.findIndex(params.table.players, {playerId: params.playerId}) >= 0);
  res.players             = [];
  res.waitingPlayer       = [];
  res.avgStack              = !!params.table.avgStack ? params.table.avgStack : 0;

  // Added condition for OFC to replace chips with coins
  if(!!params.table.players && params.table.players.length > 0) {

    // Insert details of all playing player
    for(var playerIt=0; playerIt<params.table.players.length; playerIt++) {
      res.players.push({
        playerName  : params.table.players[playerIt].playerName,
        playerId    : params.table.players[playerIt].playerId,
        chips       : !!params.table.players[playerIt].chips ? params.table.players[playerIt].chips : !!params.table.players[playerIt].coins ? params.table.players[playerIt].coins : 0
      });
    }

    // Insert details of all waiting players
    for(var queueListIt=0; queueListIt<params.table.queueList.length; queueListIt++) {
      res.waitingPlayer.push({
        playerName  : params.table.queueList[queueListIt].playerName,
        playerId  : params.table.queueList[queueListIt].playerId
      });
    }
    cb(res);
  } else {
    cb(res);
  }
};

module.exports = createGameResponse;
