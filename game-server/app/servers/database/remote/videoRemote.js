/*jshint node: true */
"use strict";

var stateOfX = require("../../../../shared/stateOfX");
var configMsg = require("../../../../shared/popupTextManager").falseMessages;
var logDB           = require("../../../../shared/model/logDbQuery.js");

var videoRemote = {};

// prepare MAIN platform step for video json data
// joinresponse + table settings
videoRemote.createJoinResponse = function(params) {
	var joinResponse = {};
	var players      = [];

	for(var i=0;i<params.table.players.length;i++){
	  players.push({
	    channelId          : params.table.players[i].channelId,
	    playerId           : params.table.players[i].playerId,
	    playerName         : params.table.players[i].playerName,
	    chips              : params.table.players[i].chips,
	    seatIndex          : params.table.players[i].seatIndex,
	    state              : params.table.players[i].state,
	    imageAvtar         : params.table.players[i].imageAvtar,
	    totalRoundBet      : params.table.players[i].totalRoundBet,
	    lastMove           : params.table.players[i].lastMove,
	    moves              : params.table.players[i].moves,
	    bestHands          : params.table.players[i].bestHands,
	    preCheck           : params.table.players[i].preCheck,
	    sitoutNextBigBlind : params.table.players[i].sitoutNextBigBlind,
	    sitoutNextHand     : params.table.players[i].sitoutNextHand,
	    isTournamentSitout : params.table.players[i].tournamentData.isTournamentSitout
	  });
	}

	var roomConfig                  = {};
	    roomConfig.id               = params.table.channelId;
	    roomConfig.tableId          = "";
	    roomConfig.channelType      = params.table.channelType;
	    roomConfig.smallBlind       = params.table.smallBlind;
	    roomConfig.bigBlind         = params.table.bigBlind;
	    roomConfig.isStraddleEnable = params.table.isStraddleEnable;
	    roomConfig.turnTime         = params.table.turnTime;
	    roomConfig.extraTurnTime    = 2*(params.table.turnTime);
	    roomConfig.channelName      = params.table.channelName;
	    roomConfig.channelVariation = params.table.channelVariation;
	    roomConfig.isRealMoney      = params.table.isRealMoney;
	    roomConfig.minBuyIn         = params.table.minBuyIn;
	    roomConfig.maxBuyIn         = params.table.maxBuyIn;
	    roomConfig.minPlayers       = params.table.minPlayers;
	    roomConfig.maxPlayers       = params.table.maxPlayers;
	    roomConfig.info             = "This is the game info.";

	var tableDetails                    = {};
	    tableDetails.channelType        = params.table.channelType;
	    tableDetails.roundId            = params.table.roundId;
	    tableDetails.smallBlind         = params.table.smallBlind;
	    tableDetails.bigBlind           = params.table.bigBlind;
	    tableDetails.turnTime           = params.table.turnTime;
	    tableDetails.extraTurnTime      = 2*(params.table.turnTime);
	    tableDetails.isStraddleEnable   = params.table.isStraddleEnable;
	    tableDetails.state              = stateOfX.gameState.idle;
	    tableDetails.roundCount         = 0;
	    tableDetails.roundName          = params.table.roundName;
	    tableDetails.roundBets          = params.table.roundBets;
	    tableDetails.roundMaxBet        = params.table.roundMaxBet;
	    tableDetails.maxBetAllowed      = params.table.maxBetAllowed;
	    tableDetails.pot                = params.table.pot;
	    tableDetails.boardCard          = params.table.boardCard;
	    tableDetails.dealerIndex        = params.table.dealerIndex;
	    tableDetails.smallBlindIndex    = params.table.smallBlindIndex;
	    tableDetails.bigBlindIndex      = params.table.bigBlindIndex;
	    tableDetails.straddleIndex      = params.table.straddleIndex;
	    tableDetails.currentMoveIndex   = params.table.currentMoveIndex;
	    tableDetails.minRaiseAmount     = params.table.minRaiseAmount;
	    tableDetails.maxRaiseAmount     = params.table.maxRaiseAmount;
	    tableDetails.totalPot           = 0;
	    tableDetails.isTimeBankUsed     = false;
	    tableDetails.totalTimeBank      = null;
	    tableDetails.timeBankLeft       = null;
	    tableDetails.additionalTurnTime = 0;
	    tableDetails.remainingMoveTime  = 0;
	    tableDetails.players            = players;

	joinResponse.success       = true;
	joinResponse.tableDetails  = tableDetails;
	joinResponse.roomConfig    = roomConfig;
	joinResponse.channelId     = params.table.channelId;
	joinResponse.tableId       = "";
	joinResponse.playerId      = "";
	joinResponse.playerName    = "";
	joinResponse.cards         = [];
	joinResponse.isJoinWaiting = false;
	joinResponse.isJoinedOnce  = false;
	joinResponse.settings      = {muteGameSound: true, dealerChat: false, playerChat: false, tableColor: 3, isMuckHand: false};
  joinResponse.antibanking   = {isAntiBanking: false, amount: -1, timeRemains: -1};
	joinResponse.route         = "room.channelHandler.joinChannel";
	return joinResponse;
};

// prepare game players data for video json data
videoRemote.createGamePlyersResponse = function(params) {
	var gamePlayers          = {};
  gamePlayers.data         = {};
  gamePlayers.data.removed = [];
  gamePlayers.data.players = [];
  gamePlayers.data.route   = "gamePlayers";
  for(var i = 0; i < params.table.players.length; i++){
    gamePlayers.data.players.push({
      playerId  : params.table.players[i].playerId,
      chips     : params.table.players[i].chips,
      state     : params.table.players[i].state,
      moves     : [],
      playerName: params.table.players[i].playerName
    });
  }
  return gamePlayers;
};

// update hand tab record for cards and video id
videoRemote.updateHandTab = function(params,cb) {
logDB.updateHandTab(params.channelId,params.roundId,params.data,function(err,response){
    if(err){
      // next(null, {success: false, channelId: msg.channelId, info:"video insertion failed"});
      cb(null, {success: false, channelId: params.channelId, info: configMsg.INSERTVIDEOLOGFAIL_ENTRYHANDLER, isRetry: false, isDisplay: false});
    } else{
      //broadcastHandler.fireHandtabBroadcast({channel: channel, channelId: msg.channelId, handTab: response.value});
      cb(null, {success: true, response:response, channelId: params.channelId, info:"video added successfully", isRetry: false, isDisplay: false});
    }
  });
};

module.exports = videoRemote;