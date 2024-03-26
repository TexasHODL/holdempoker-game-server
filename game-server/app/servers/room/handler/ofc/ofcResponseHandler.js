/*jshint node: true */
"use strict";

/**
 * Created by Amrendra on 14/11/2016.
**/
var _                       = require('underscore'),
    _ld                     = require('lodash'),
    async                   = require('async'),
    stateOfX                = require("../../../../../shared/stateOfX"),
    zmqPublish              = require("../../../../../shared/infoPublisher"),
    ofcResponseHandler   = {};


// Generate keys for join channel or autosit player response

ofcResponseHandler.setJoinChannelKeys = function(params, cb) {
  // console.log(_.keys(params));
  var res     = {};
  res.success = true;
  params.table = _.omit(params.table, 'deck');
  res.tableDetails = {};
  res.roomConfig   = {};
  

  // Add general values for join channel res
  var playerIndex   = _ld.findIndex(params.table.players, {playerId: params.playerId});
  res.success       = true;
  res.channelId     = params.table.channelId;
  res.playerId      = params.playerId;
  res.playerName    = params.playerName;
  res.cards         = playerIndex >= 0 ? params.table.players[playerIndex].cards : {top: [], middle: [], bottom: []};
  res.roundName     = playerIndex >= 0 ? params.table.players[playerIndex].roundName : "";
  res.currentCards  = playerIndex >= 0 ? params.table.players[playerIndex].currentCards : [];
  res.discardedCard = playerIndex >= 0 ? params.table.players[playerIndex].discardedCard : [];
  res.isJoinWaiting = _ld.findIndex(params.table.queueList, {playerId: params.playerId}) >= 0;
  res.settings      = params.data.settings || {muteGameSound: true, dealerChat: false, playerChat: false, tableColor: 3, isMuckHand: false};

  // Add table details for join res
  // console.log('Table while sending join res - ' + JSON.stringify(params.table));
  
  // Dynamic data for inside Game playe (table details)
  res.tableDetails.channelType      = params.table.channelType;
  res.tableDetails.turnTime         = params.table.turnTime;
  res.tableDetails.extraTurnTime    = stateOfX.extraTimeBank[params.channel.turnTime];
  res.tableDetails.state            = params.table.state;
  res.tableDetails.roundCount       = params.table.roundCount;
  res.tableDetails.roundName        = params.table.roundName;
  res.tableDetails.dealerIndex      = params.table.dealerIndex >= 0 && !!params.table.players[params.table.dealerIndex] ? params.table.players[params.table.dealerIndex].seatIndex : -1;
  res.tableDetails.currentMoveIndex = params.table.currentMoveIndex >= 0 && !!params.table.players[params.table.currentMoveIndex] ? params.table.players[params.table.currentMoveIndex].seatIndex : -1;
  
  // Static details for inside Game (Client request)
  res.roomConfig._id                = params.table.channelId;
  res.roomConfig.channelType        = params.table.channelType;
  res.roomConfig.turnTime           = params.table.turnTime;
  res.tableDetails.extraTurnTime    = stateOfX.extraTimeBank[params.channel.turnTime];
  res.roomConfig.channelName        = params.table.channelName;
  res.roomConfig.channelVariation   = params.table.channelVariation;
  res.roomConfig.isRealMoney        = params.table.isRealMoney;
  res.roomConfig.minBuyIn           = params.table.minBuyIn;
  res.roomConfig.maxBuyIn           = params.table.maxBuyIn;
  res.roomConfig.minPlayers         = params.table.minPlayers;
  res.roomConfig.maxPlayers         = params.table.maxPlayers;
  res.roomConfig.info               = params.table.gameInfo;

  // console.log('---- Player remaining time ---- ');
  // console.log('Table state while calculating remaining time - ' + params.table.state);
  // console.log('Player move at - ' + (new Date(params.table.turnTimeStartAt)));
  // console.log('Current time - ' + (new Date(new Date().getTime())));
  // console.log('Each player turn time - ' + params.table.turnTime)
  
  var timeLapsed = parseInt((((new Date().getTime()) - (params.table.turnTimeStartAt))/1000)%60);

  // console.log('Time lapsed - ' + timeLapsed);

  // console.log('Remaining time - ' + parseInt(params.table.turnTime - timeLapsed));
  
  res.tableDetails.additionalTurnTime = 0;
  res.tableDetails.remainingMoveTime  = params.table.state === stateOfX.gameState.running ? parseInt(params.table.turnTime) - parseInt(timeLapsed) : 0;
  console.log('Players - ' + JSON.stringify(params.table.players));  
  console.log('Current move index  - ' + params.table.currentMoveIndex);
  console.log('Current player details - ' + JSON.stringify(params.table.players[params.table.currentMoveIndex]));
  
  var extraTimeBankAllowed = (params.table.state === stateOfX.gameState.running && params.table.currentMoveIndex >= 0 && params.table.players[params.table.currentMoveIndex].state === stateOfX.playerState.disconnected);
  if(!extraTimeBankAllowed) {
    extraTimeBankAllowed = params.table.state === stateOfX.gameState.running && params.table.currentMoveIndex >= 0 && (params.table.players[params.table.currentMoveIndex].playerId === params.playerId && params.data.previousState === stateOfX.playerState.disconnected);
  }

  if(extraTimeBankAllowed) {
    res.tableDetails.additionalTurnTime = res.tableDetails.extraTurnTime - params.table.turnTime;
    res.tableDetails.remainingMoveTime  = parseInt(params.table.turnTime) + parseInt(res.tableDetails.extraTurnTime) - parseInt(timeLapsed);
  }
  
  // res.tableDetails.remainingMoveTime = params.table.state === stateOfX.gameState.running ? parseInt(params.table.turnTime - timeLapsed) : 0;

  res.tableDetails.players = [];
  async.each(params.table.players, function(player, ecb) {
    // console.log('Player in join - ' + JSON.stringify(player));
    res.tableDetails.players.push({
      channelId       : player.channelId,
      playerId        : player.playerId,
      playerName      : player.playerName,
      points          : player.points,
      seatIndex       : player.seatIndex,
      state           : player.state,
      imageAvtar      : player.imageAvtar,
      cards           : player.cards,
      roundName       : player.roundName,
      discardedCard   : player.discardedCard,
      isInFantasyLand : player.isInFantasyLand
    });
    ecb();
  }, function(err){
    // console.log('Final join res - ' + JSON.stringify(res))
    // params.res = res;
    cb(res);
  });
};

module.exports = ofcResponseHandler;