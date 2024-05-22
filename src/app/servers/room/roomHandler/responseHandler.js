/*jshint node: true */
"use strict";

  /**
 * Created by Amrendra on 29/09/2016.
**/
var _                       = require('underscore'),
    _ld                     = require('lodash'),
    async                   = require('async'),
    zmqPublish              = require("../../../../shared/infoPublisher"),
    stateOfX                = require("../../../../shared/stateOfX"),
    createHandlerResponse   = {};
const configConstants = require('../../../../shared/configConstants');
// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'responseHandler';
  logObject.serverName    = stateOfX.serverType.connector;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// Sum total pot from array of pots

createHandlerResponse.getTotalPot = function(pot) {
  var totalPot = 0;
  for (var i = 0; i < pot.length; i++) {
    totalPot = parseInt(totalPot) + parseInt(pot[i].amount);
  }
  return totalPot;
};

// Get sum of total dead bets

createHandlerResponse.getTotalBet = function(bets) {
  var totalBets = 0;
  for (var i = 0; i < bets.length; i++) {
    totalBets = parseInt(totalBets) + parseInt(bets[i]);
  }
  return totalBets;
};

//this function updates the next blind info into the response
//tournament
var setNextBlindInfoForJoinChannelKeys = function(params){
  console.log("current date in ", Number(new Date()));
  console.log("tournament start time ", new Date(params.tournamentStartTime), params.tournamentStartTime );
  console.log("blindRuleData",Number(new Date()), params.blindRuleData);
  console.log("nextBlindInfo", Number(new Date()), params.nextBlindInfo);


  var nextBlindData = {};
  nextBlindData.nextBigBlind = !!(params.nextBlindInfo)?(params.nextBlindInfo.bigBlind):(params.blindRuleData[0].bigBlind);
  nextBlindData.nextSmallBlind = !!(params.nextBlindInfo)?(params.nextBlindInfo.smallBlind):(params.blindRuleData[0].smallBlind);
  nextBlindData.nextAnte = !!(params.nextBlindInfo)?(params.nextBlindInfo.ante):(params.blindRuleData[0].ante);
  // nextBlindData.blindTimeRemaining = !!(params.nextBlindInfo)?(params.nextBlindInfo.nextBlindUpdateTime - Number(new Date())):(params.tournamentStartTime + params.blindRuleData[0].minutes*60000 - Number(new Date()));
  // if(!!params.nextBlindInfo && params.nextBlindInfo.nextBlindUpdateTime == -1) {
  //   nextBlindData.blindTimeRemaining = -1;
  // }
  console.log("nextBlindData is - ",nextBlindData);
  return nextBlindData;
};

//this function calculates the addon time remaining
//tournament
var calculateAddonTimeRemaining = function(params){
  console.log("params in calculateAddonTimeRemaining is ", JSON.stringify(params));
  var level = 0;
  for(var i=0; i< params.addonTime.length; i++){
      if(params.blindLevel < params.addonTime[i].level){
        level = params.addonTime[i].level;
        break;
      }
    }
    console.log("params.addonTime in responseHanler is ",params.addonTime.length);
    console.log("params.blindRuleData in responseHandler is   ",params.blindRuleData);
    console.log("the value of level is    ",level);
    var addonTime = _.where(params.blindRuleData, {level : level});
    console.log("addonTime in responseHandler is ",addonTime);
    console.log(params.blindRuleData, level, "inside calculateAddonTimeRemaining...........", addonTime[0]);
    if(params.blindLevel >= params.addonTime[params.addonTime.length-1].level){
      return -1;
    }

    return (params.tournamentStartTime + addonTime[0].minutes*60000 - Number(new Date()));
};


// Generate keys for join channel or autosit player response
// params contains table, data
createHandlerResponse.setJoinChannelKeys = function(params, cb) {
   var res          = {};
  res.success      = true;
  params.table     = _.omit(params.table, 'deck');
  res.tableDetails = {};
  res.roomConfig   = {};
  
  serverLog(stateOfX.serverLogType.info, 'Table while sending join response: ' + JSON.stringify(params.table));
  serverLog(stateOfX.serverLogType.info, 'Data while sending join response: ' + JSON.stringify(params.data));
  // Add general values for join channel res
  var playerIndex   = _ld.findIndex(params.table.players, {playerId: params.playerId});
  res.success       = true;
  res.channelId     = params.table.channelId;
  res.tableId       = !!params.tableId ? params.tableId : "";
  res.playerId      = params.playerId;
  res.playerName    = params.playerName;
  res.cards         = playerIndex >= 0 ? params.table.players[playerIndex].cards : [];
  res.bestHands     = playerIndex >= 0 ? params.table.players[playerIndex].bestHands : "";
  res.lastMove      = playerIndex >= 0 ? params.table.players[playerIndex].lastMove : "";
  res.isRunItTwice  = playerIndex >= 0 ? params.table.players[playerIndex].isRunItTwice : false,
  res.isForceBlindEnable  = playerIndex >= 0 ? params.table.players[playerIndex].isForceBlindEnable : true,
  res.isJoinWaiting = _ld.findIndex(params.table.queueList, {playerId: params.playerId}) >= 0;
  res.settings      = params.data.settings || {muteGameSound: true, dealerChat: false, playerChat: false, tableColor: 3, isMuckHand: false};

    res.antibanking   = params.data.antibanking || {isAntiBanking: false, amount: -1, timeRemains: -1};
  // Set antibanking key only for normal games, not in tournament
  if(params.table.channelType !== stateOfX.gameType.tournament) {
  }
    res.antibanking   = params.data.antibanking || {isAntiBanking: false, amount: -1, timeRemains: -1};

  // Add table details for join res
  
  // Dynamic data for inside Game playe (table details)
  res.tableDetails.channelType      = params.table.channelType;
  res.tableDetails.isForceRit       = params.table.isForceRit;
  res.tableDetails.roundId          = params.table.roundId;
  res.tableDetails.smallBlind       = params.table.smallBlind;
  res.tableDetails.bigBlind         = params.table.bigBlind;
  res.tableDetails.turnTime         = params.table.turnTime;
  res.tableDetails.extraTurnTime    = stateOfX.extraTimeBank[params.table.turnTime]||stateOfX.extraTimeBank['default'];
  res.tableDetails.isStraddleEnable = params.table.isStraddleEnable;
  res.tableDetails.runItTwiceEnable = params.table.runItTwiceEnable;
  res.tableDetails.state            = params.table.state;
  res.tableDetails.roundCount       = params.table.roundCount;
  res.tableDetails.roundNumber      = params.table.roundNumber;
  res.tableDetails.roundName        = params.table.roundName;
  res.tableDetails.roundBets        = params.table.roundBets;
  res.tableDetails.roundMaxBet      = params.table.roundMaxBet;
  res.tableDetails.maxBetAllowed    = params.table.maxBetAllowed;
  res.tableDetails.pot              = _.pluck(params.table.pot, 'amount');
  res.tableDetails.boardCard        = params.table.boardCard;
  res.tableDetails.dealerIndex      = params.table.dealerSeatIndex;
  res.tableDetails.smallBlindIndex  = params.table.smallBlindIndex >= 0 && !!params.table.players[params.table.smallBlindIndex] ? params.table.players[params.table.smallBlindIndex].seatIndex : -1;
  res.tableDetails.bigBlindIndex    = params.table.bigBlindIndex >= 0 && !!params.table.players[params.table.bigBlindIndex] ? params.table.players[params.table.bigBlindIndex].seatIndex : -1;
  res.tableDetails.straddleIndex    = params.table.straddleIndex >= 0 && !!params.table.players[params.table.straddleIndex] ? params.table.players[params.table.straddleIndex].seatIndex : -1;
  res.tableDetails.currentMoveIndex = params.table.currentMoveIndex >= 0 && !!params.table.players[params.table.currentMoveIndex] ? params.table.players[params.table.currentMoveIndex].seatIndex : -1;
  res.tableDetails.minRaiseAmount   = params.table.minRaiseAmount;
  res.tableDetails.maxRaiseAmount   = params.table.maxRaiseAmount;
  res.tableDetails.isPrivate = params.table.isPrivate;
  res.tableDetails.totalPot         = createHandlerResponse.getTotalPot(params.table.pot) + createHandlerResponse.getTotalBet(params.table.roundBets);
  // res.tableDetails.breakLevel       = 0;

  if(params.table.channelType === stateOfX.gameType.tournament) {
    res.tableDetails.breakRuleId      = params.table.breakRuleId;
    res.tableDetails.blindLevel      = params.table.blindLevel;
    res.tableDetails.nextBlindLevel = !!(params.table.blindRuleData[params.table.blindLevel+1])?(params.table.blindRuleData[params.table.blindLevel+1].level) : -1;
    // res.tableDetails.breakRuleData    = params.table.breakRuleData || {};
    // res.tableDetails.blindRuleData    = params.table.blindRuleData || {};
    // res.tableDetails.timeBankRuleData = params.table.timeBankRuleData || {};
    // res.tableDetails.breakTimeRemaining = params.table.nextBlindInfo.nextBlindUpdateTime - Number(new Date());
    // res.tableDetails.nextBigBlind = params.table.nextBlindInfo.bigBlind;
    res.tableDetails.isOnBreak          = params.table.isOnBreak;
    var breakTime = params.table.breakRuleData[params.table.breakLevel].timeAfterTournamentStart;
    res.tableDetails.breakTimeRemaining = params.table.tournamentStartTime + breakTime*60000 - Number(new Date());
    res.tableDetails.breakTimeRemaining = params.table.tournamentStartTime + breakTime*60000 - Number(new Date());
    if(params.table.isOnBreak){
      res.tableDetails.isBreakTimerStart = params.table.isBreakTimerStart;
      if(params.table.isBreakTimerStart){
        res.tableDetails.breakEnds = params.table.timerStarted + params.table.breakRuleData[params.table.breakLevel].breakDuration*60000 - Number(new Date());
      }
        res.tableDetails.breakTimeRemaining = -1;
    }
    res.tableDetails.rebuyTimeRemaining = params.table.tournamentStartTime + params.table.rebuyTime*60000 - Number(new Date());
    if(res.tableDetails.rebuyTimeRemaining <= 0)
    {
      res.tableDetails.rebuyTimeRemaining = -1;
    }
    res.tableDetails.tournamentName     = params.table.tournamentName;
    // res.tableDetails.isBreak            = params.table.isOnBreak;
    res.tableDetails.isRebuy            = params.table.isRebuyAllowed;
    res.tableDetails.isAddon            = params.table.isAddonEnabled;
    res.tableDetails.addonTimeRemaining = calculateAddonTimeRemaining(params.table);
    res.tableDetails.isAutoRebuy        = params.table.players[playerIndex].isAutoReBuyEnabled;
    res.tableDetails.isAutoAddOn        = params.table.players[playerIndex].isAutoAddOnEnabled;
    var nextBlindData                   = setNextBlindInfoForJoinChannelKeys(params.table);
    console.log("nextBlindData-----------", nextBlindData );
    res.roomConfig.nextBigBlind         = nextBlindData.nextBigBlind;
    res.roomConfig.nextSmallBlind       = nextBlindData.nextSmallBlind;
    res.roomConfig.nextAnte             = nextBlindData.nextAnte;
    res.tableDetails.blindTimeRemaining = nextBlindData.blindTimeRemaining;
    res.roomConfig.tournamentType       = params.table.tournamentType;


    console.log("res.tableDetails......", res.tableDetails);
    console.log("res.tableDetails......", res.roomConfig);

    
  }

  // Set time bank details in case of tournament
  res.tableDetails.isTimeBankUsed = false;
  res.tableDetails.totalTimeBank  = null;
  res.tableDetails.timeBankLeft   = null;

  // Get extra time value for current player with move
  if(params.table.channelType === stateOfX.gameType.tournament) {
    if(params.table.state === stateOfX.gameState.running && params.table.currentMoveIndex >= 0) {
      if(params.table.players[params.table.currentMoveIndex].tournamentData.isTimeBankUsed) {
        res.tableDetails.isTimeBankUsed = true;
        res.tableDetails.totalTimeBank = params.table.players[params.table.currentMoveIndex].tournamentData.timeBankLeft;
        serverLog(stateOfX.serverLogType.info, 'Total time lapsed after time bank started: ' + parseInt((((new Date().getTime()) - (params.table.timeBankStartedAt))/1000)%60) );
        res.tableDetails.timeBankLeft = parseInt(res.tableDetails.totalTimeBank) - parseInt((((new Date().getTime()) - (params.table.timeBankStartedAt))/1000)%60);
        serverLog(stateOfX.serverLogType.info, 'Total time bank: ' + res.tableDetails.totalTimeBank + ' and time left to act: ' + res.tableDetails.timeBankLeft);
      } else {
        serverLog(stateOfX.serverLogType.info, 'Not calculating time bank values as current player havent use time bank yet!');
      }
    } else {
       serverLog(stateOfX.serverLogType.info, 'Not calculating time bank values as either game is not running or no current player index set!');
    }
  } else {
    serverLog(stateOfX.serverLogType.info, 'Calculating time bank values for join response');
    if(params.table.state === stateOfX.gameState.running && params.table.currentMoveIndex >= 0) {
      if(params.table.players[params.table.currentMoveIndex].isTimeBankUsed) {
        res.tableDetails.isTimeBankUsed = true;
        res.tableDetails.totalTimeBank = params.table.players[params.table.currentMoveIndex].timeBankSec;
        serverLog(stateOfX.serverLogType.info, 'Total time lapsed after time bank started: ' + parseInt((((new Date().getTime()) - (params.table.players[params.table.currentMoveIndex].timeBankStartedAt))/1000)%60) );
        res.tableDetails.timeBankLeft = parseInt(res.tableDetails.totalTimeBank) - parseInt((((new Date().getTime()) - (params.table.players[params.table.currentMoveIndex].timeBankStartedAt))/1000)%60);
        serverLog(stateOfX.serverLogType.info, 'Total time bank: ' + res.tableDetails.totalTimeBank + ' and time left to act: ' + res.tableDetails.timeBankLeft);
      } else {
        serverLog(stateOfX.serverLogType.info, 'Not calculating time bank values as current player havent use time bank yet!');
      }
    } else {
       serverLog(stateOfX.serverLogType.info, 'Not calculating time bank values as either game is not running or no current player index set!');
    }
  }

  // Static details for inside Game (Client request)
  res.roomConfig._id              = params.table.channelId;
  res.roomConfig.tableId          = (!!params.table.tournamentRules && !!params.table.tournamentRules.tournamentId) ? params.table.tournamentRules.tournamentId : "";
  res.roomConfig.channelType      = params.table.channelType;
  res.roomConfig.smallBlind       = params.table.smallBlind;
  res.roomConfig.bigBlind         = params.table.bigBlind;
  res.roomConfig.isStraddleEnable = params.table.isStraddleEnable;
  res.roomConfig.turnTime         = params.table.turnTime;
  res.roomConfig.isPotLimit       = params.table.isPotLimit;
  res.roomConfig.extraTurnTime    = stateOfX.extraTimeBank[params.table.turnTime]||stateOfX.extraTimeBank['default'];
  res.roomConfig.channelName      = params.table.channelName;
  res.roomConfig.channelVariation = params.table.channelVariation;
  res.roomConfig.isRealMoney      = params.table.isRealMoney;
  res.roomConfig.smallBlind       = params.table.smallBlind;
  res.roomConfig.bigBlind         = params.table.bigBlind;
  res.roomConfig.minBuyIn         = params.table.minBuyIn;
  res.roomConfig.maxBuyIn         = params.table.maxBuyIn;
  res.roomConfig.minPlayers       = params.table.minPlayers;
  res.roomConfig.maxPlayers       = params.table.maxPlayers;
  res.roomConfig.info             = params.table.gameInfo;
  // res.roomConfig.nextBigBlind     = params.table.nextBlindInfo.bigBlind;
  // res.roomConfig.nextSmallBlind   = params.table.nextBlindInfo.smallBlind;
  // res.roomConfig.nextAnte         = params.table.nextBlindInfo.nextAnte;
  

    

  serverLog(stateOfX.serverLogType.info, 'Player move time start at - ' + (new Date(params.table.turnTimeStartAt)));
  serverLog(stateOfX.serverLogType.info, 'Current time - ' + (new Date(new Date().getTime())));
  
  var timeLapsed = parseInt((((new Date().getTime()) - (params.table.turnTimeStartAt))/1000));

  serverLog(stateOfX.serverLogType.info, 'Time lapsed - ' + timeLapsed);

  // var totalTurnTime =  playerIndex >= 0 ? (params.table.players[playerIndex].state === stateOfX.playerState.disconnected) ? parseInt(params.table.turnTime) +  : -1;
  res.tableDetails.additionalTurnTime = parseInt(params.table.turnTime);
  res.tableDetails.remainingMoveTime  = params.table.state === stateOfX.gameState.running ? parseInt(params.table.turnTime) - parseInt(timeLapsed) : 0;
console.error(stateOfX.serverLogType.info, 'Additional turn time: ' + res.tableDetails.additionalTurnTime + ' and remaining move time: ' + res.tableDetails.remainingMoveTime);
  serverLog(stateOfX.serverLogType.info, 'Players on table: ' + JSON.stringify(params.table.players));  
  serverLog(stateOfX.serverLogType.info, 'Current move index: ' + params.table.currentMoveIndex);
  
  if(params.table.currentMoveIndex >= 0) {
    serverLog(stateOfX.serverLogType.info, 'Current player details: ' + JSON.stringify(params.table.players[params.table.currentMoveIndex]));
  }
  
  var detTimeAllowed = (params.table.state === stateOfX.gameState.running && params.table.currentMoveIndex >= 0 && params.table.players[params.table.currentMoveIndex].state === stateOfX.playerState.disconnected);
  if(!detTimeAllowed) {
    detTimeAllowed = params.table.state === stateOfX.gameState.running && params.table.currentMoveIndex >= 0 && (params.table.players[params.table.currentMoveIndex].playerId === params.playerId && params.data.previousState === stateOfX.playerState.disconnected);
  }

  serverLog(stateOfX.serverLogType.info, 'Extra time allowed for disconnected player in this join response: ' + detTimeAllowed);

  if(detTimeAllowed) {
     if(parseInt(timeLapsed) > parseInt(params.table.turnTime)){
        res.tableDetails.remainingMoveTime = parseInt(res.tableDetails.extraTurnTime) + parseInt(params.table.turnTime) + configConstants.isConnectedCheckTime - parseInt(timeLapsed);
        res.tableDetails.additionalTurnTime = res.tableDetails.extraTurnTime;// -  configConstants.isConnectedCheckTime;
        console.error(res.tableDetails.additionalTurnTime);
        console.trace(res.tableDetails.remainingMoveTime);
      }else{
        res.tableDetails.remainingMoveTime = parseInt(params.table.turnTime)- parseInt(timeLapsed);
        res.tableDetails.additionalTurnTime = parseInt(params.table.turnTime) ;
      }
    // res.tableDetails.remainingMoveTime  = parseInt(params.table.turnTime) + parseInt(res.tableDetails.extraTurnTime) - parseInt(timeLapsed)
  }
console.error(stateOfX.serverLogType.info, 'Additional turn time: ' + res.tableDetails.additionalTurnTime + ' and remaining move time: ' + res.tableDetails.remainingMoveTime);
// res.tableDetails.remainingMoveTime
  if(res.tableDetails.remainingMoveTime < 0) {
    serverLog(stateOfX.serverLogType.info, 'Remaining move time was in negative: ' + res.tableDetails.remainingMoveTime);
    res.tableDetails.remainingMoveTime = parseInt(params.table.turnTime) + parseInt(res.tableDetails.extraTurnTime) + configConstants.isConnectedCheckTime - parseInt(timeLapsed);
      res.tableDetails.additionalTurnTime = res.tableDetails.extraTurnTime ;
  }

  console.error(stateOfX.serverLogType.info, 'Additional turn time: ' + res.tableDetails.additionalTurnTime + ' and remaining move time: ' + res.tableDetails.remainingMoveTime);


/*if(res.tableDetails.remainingMoveTime > parseInt(res.tableDetails.extraTurnTime)){
  res.tableDetails.remainingMoveTime = parseInt(res.tableDetails.extraTurnTime) - parseInt(timeLapsed);
  res.tableDetails.additionalTurnTime = res.tableDetails.extraTurnTime;
}*/

console.error(stateOfX.serverLogType.info, 'Additional turn time: ' + res.tableDetails.additionalTurnTime + ' and remaining move time: ' + res.tableDetails.remainingMoveTime);
  res.tableDetails.players = [];
  async.each(params.table.players, function(player, ecb) {
    res.tableDetails.players.push({
      channelId           : player.channelId,
      playerId            : player.playerId,
      playerName          : player.playerName,
      chips               : player.chips,
      seatIndex           : player.seatIndex,
      state               : player.state,
      isPartOfGame        : (params.table.state == stateOfX.gameState.running && params.table.roundId == player.roundId),
      imageAvtar          : "",
      totalRoundBet       : player.totalRoundBet,
      lastMove            : player.lastMove,
      moves               : player.moves,
      preCheck            : /*(player.lastMove=="FOLD" || player.chips<=0) ? -1 :*/ player.preCheck,
      precheckValue       : player.precheckValue || stateOfX.playerPrecheckValue.NONE,
      sitoutNextBigBlind  : player.sitoutNextBigBlind,
      sitoutNextHand      : player.sitoutNextHand,
      isTournamentSitout  : player.tournamentData.isTournamentSitout
    });
    ecb();
  }, function(err){
    cb(res);
  });
};

module.exports = createHandlerResponse;