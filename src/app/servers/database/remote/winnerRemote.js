/*jshint node: true */
"use strict";

/**
 * Created by Amrendra on 30/09/2016.
**/
var async        = require("async"),
    _ld          = require("lodash"),
    _            = require('underscore'),
    stateOfX     = require("../../../../shared/stateOfX"),
    keyValidator = require("../../../../shared/keysDictionary"),
    zmqPublish   = require("../../../../shared/infoPublisher"),
    tableManager = require("./tableManager");

// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'winnerRemote';
  logObject.serverName   = stateOfX.serverType.database;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  console.log(JSON.stringify(logObject));
}

function fixedDecimal(number, precisionValue) {
  let precision = precisionValue ? precisionValue : 2;
  return Number(Number(number).toFixed(precision));
}

///////////////////////////////////////////////////////////////////////
// <<<<<<<< AWARD WINNING CHIPS TO WINNER PLAYERS START >>>>>>>>>>>> //
///////////////////////////////////////////////////////////////////////

var addChipsIfRakeNotDeducted = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In function addChipsIfRakeNotDeducted');
  async.each(params.data.winners, function (winner, ecb) {
    var playerIndex = _ld.findIndex(params.table.players, {playerId: winner.playerId});
    serverLog(stateOfX.serverLogType.info, 'Winner index in table players - ' + playerIndex);
    if(playerIndex >= 0) {
      serverLog(stateOfX.serverLogType.info, 'Previous player amount - ' + params.table.players[playerIndex].chips);
      serverLog(stateOfX.serverLogType.info, 'This player winning amount - ' + winner.amount);
      // params.table.players[playerIndex].chips = parseInt(params.table.players[playerIndex].chips) + parseInt(winner.amount);
      params.table.players[playerIndex].chips = fixedDecimal(params.table.players[playerIndex].chips, 2) + fixedDecimal(winner.amount, 2);
      winner.chips                            = params.table.players[playerIndex].chips;
      winner.winningAmount                    = !!winner.winningAmount ? winner.winningAmount : winner.amount;
      serverLog(stateOfX.serverLogType.info, 'After rewarding player amount - ' + params.table.players[playerIndex].chips);
    } else {
      serverLog(stateOfX.serverLogType.error, 'Winner player left, unable to add on-table chips!');
    }
    ecb();
    }, function (err) {
      if(err) {
        cb({success: false, channelId: params.channelId, isRetry: false, isDisplay: false, info: 'Reward distribution failed!'});
      } else {
        serverLog(stateOfX.serverLogType.info, 'After awarding winning chips players are: ' + JSON.stringify(params.table.players));
        cb(null, params);
    }
  });
};

// tournament
var awardWinningChipsForTournamentHoldem = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In function awardWinningChipsForTournamentHoldem');
  serverLog(stateOfX.serverLogType.info, 'Rake has not been deducted in this game!');
  addChipsIfRakeNotDeducted(params, function(err, res){
    cb(err, res);
  });
};

// tournament
var awardWinningChipsForTournamentOmahaHiLo = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In function awardWinningChipsForTournamentOmahaHiLo');
	serverLog(stateOfX.serverLogType.info, 'Rake has not been deducted in this game!');
  addChipsIfRakeNotDeducted(params, function(err, res){
    cb(err, res);
  });
};

// add winning chips for player if rake deducted
var addChipsIfRakeDeducted = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In function addChipsIfRakeDeducted' + JSON.stringify(params.data.decisionParams));
  async.each(Object.keys(params.rakeDetails.playerWins), function(winnerId, ecb){
    serverLog(stateOfX.serverLogType.info, 'Processing winner player id to add winning amount - ' + winnerId);
    var playerIndex = _ld.findIndex(params.table.players, {playerId: winnerId});
    if(playerIndex >= 0) {
      serverLog(stateOfX.serverLogType.info, 'Before updating winning chips into players on table chips - ' + params.table.players[playerIndex].chips + '!');
      serverLog(stateOfX.serverLogType.info, 'Total win for this player from this table - ' + params.rakeDetails.playerWins[winnerId] + '!');
      params.table.players[playerIndex].chips = params.table.players[playerIndex].chips + params.rakeDetails.playerWins[winnerId];
      var isRefundPlayer = _.where(params.data.decisionParams, {isRefund: true});
      serverLog(stateOfX.serverLogType.info," palyer with refund amount - "+ JSON.stringify(isRefundPlayer));
      //check channel variation for omaha hi lo
      // if(params.table.channelVariation === stateOfX.channelVariation.omahahilo){
      //   if(isRefundPlayer.length > 0 && isRefundPlayer[0].winners.winnerHigh[0].playerId === winnerId){
      //     serverLog(stateOfX.serverLogType.info, 'refund amount - ' + isRefundPlayer[0].amount + ' is about to add winners chips.');
      //     params.table.players[playerIndex].chips +=  isRefundPlayer[0].amount;
      //   }
      // }else{
      //   if(isRefundPlayer.length > 0 && isRefundPlayer[0].winners[0].playerId === winnerId){
      //     serverLog(stateOfX.serverLogType.info, 'refund amount - ' + isRefundPlayer[0].amount + ' is about to add winners chips.');
      //     params.table.players[playerIndex].chips +=  isRefundPlayer[0].amount;
      //   }              
      // }
      params.data.rewardDistributed = true;
      serverLog(stateOfX.serverLogType.info, 'Winners after adding current winner winning chips - ' + JSON.stringify(params.data.winners));
      serverLog(stateOfX.serverLogType.info, 'After updating winning chips into players on table chips - ' + params.table.players[playerIndex].chips + '!');
    } else {
      serverLog(stateOfX.serverLogType.error, 'Winner player left, unable to add on-table chips!');
    }
    ecb();
  }, function(err){
    if(!err) {
      serverLog(stateOfX.serverLogType.info, 'After awarding winning chips players are: ' + JSON.stringify(params.table.players));
      cb(null, params);
    } else {
      cb({success: false, channelId: params.channelId, isRetry: false, isDisplay: false, info: "Awarding winning chips failed on Game Over!" + JSON.stringify(err)});
    }
  });
};

// add winning chips for holdem and omaha
var awardWinningChipsHoldemAndOmaha = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In function awardWinningChipsHoldemAndOmaha');
	serverLog(stateOfX.serverLogType.info, 'Winners before adding winning chips - ' + JSON.stringify(params.data.winners));
	if(Object.keys(params.rakeDetails.playerWins).length > 0) {
    serverLog(stateOfX.serverLogType.info, 'Rake has been deducted in this game!');
    addChipsIfRakeDeducted(params, function(err, res){
      cb(err, res);
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'Rake has not been deducted in this game!');
    addChipsIfRakeNotDeducted(params, function(err, res){
      cb(err, res);
    });
  }
};

// add winning chips for omaha-hi-lo only
var awardWinningChipsOmahaHiLo = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In function awardWinningChipsOmahaHiLo');
  if(Object.keys(params.rakeDetails.playerWins).length > 0) {
    serverLog(stateOfX.serverLogType.info, 'Rake has been deducted in this game!');
    addChipsIfRakeDeducted(params, function(err, res){
      cb(err, res);
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'Rake has not been deducted in this game!');
    addChipsIfRakeNotDeducted(params, function(err, res){
      cb(err, res);
    });
  }
};

// add winning chips to players
// all variations and players
module.exports.awardWinningChips = function(params, cb) {
  
  serverLog(stateOfX.serverLogType.info, 'In function awardWinningChips');
  serverLog(stateOfX.serverLogType.info, 'Going to award winner for ' + params.table.channelType + ' : ' + params.table.channelVariation);
  serverLog(stateOfX.serverLogType.info, 'Pot on table: ' + JSON.stringify(params.table.pot));
  serverLog(stateOfX.serverLogType.info, 'Pot after dividing table: ' + JSON.stringify(params.data.pot));
  serverLog(stateOfX.serverLogType.info, 'awardWinningChips decision params: ' + JSON.stringify(params.data.decisionParams));
  serverLog(stateOfX.serverLogType.info, 'awardWinningChips winners: ' + JSON.stringify(params.data.winners));
  serverLog(stateOfX.serverLogType.info, 'Deducted rake details for this game - ' + JSON.stringify(params.rakeDetails));


  if(params.table.channelType === stateOfX.gameType.tournament) {
  	if(params.table.channelVariation !== stateOfX.channelVariation.omahahilo) {
  		awardWinningChipsForTournamentHoldem(params, function(err, awardWinningChipsResponse){ cb(err, awardWinningChipsResponse); });
  	} else {
  		awardWinningChipsForTournamentOmahaHiLo(params, function(err, awardWinningChipsForTournamentOmahaHiLoResponse){ cb(err, awardWinningChipsForTournamentOmahaHiLoResponse); });
  	}
  } else{
  	if(params.table.channelVariation !== stateOfX.channelVariation.omahahilo) {
  		awardWinningChipsHoldemAndOmaha(params, function(err, awardWinningChipsHoldemAndOmahaResponse){ cb(err, awardWinningChipsHoldemAndOmahaResponse); });
  	} else {
  		awardWinningChipsOmahaHiLo(params, function(err, awardWinningChipsOmahaHiLoResponse){ cb(err, awardWinningChipsOmahaHiLoResponse); });
  	}
  }
};

//////////////////////////////////////////////////////////////////////
// <<<<<<<< AWARD WINNING CHIPS TO WINNER PLAYERS ENDS >>>>>>>>>>>> //
//////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////
// <<<<<<<< GET SINGLE WINNER PLAYER START >>>>>>>>>>>> //
//////////////////////////////////////////////////////////

module.exports.getSingleWinner = function(params, cb) {
	
	serverLog(stateOfX.serverLogType.info, 'In function getSingleWinner');
  serverLog(stateOfX.serverLogType.info, 'players while deciding single winner - ' + JSON.stringify(params.table.players));

  var playingPlayers = [];
  for (var i = 0; i < params.table.players.length; i++) {
    if (params.table.onStartPlayers.indexOf(params.table.players[i].playerId)>=0 && params.table.players[i].roundId == params.table.roundId) {
      playingPlayers.push(params.table.players[i]);
    }
  }
  // var playingPlayers          = _.where(params.table.players, {state: stateOfX.playerState.playing});
  var tournamentSitoutPlayers = tableManager.getTournamentSitoutPlayers(params.table);
  var disconnectedPlayers     = _.where(params.table.players, {state: stateOfX.playerState.disconnected});
  var disconnActivePlayers    = _.where(disconnectedPlayers, {lastRoundPlayed: stateOfX.round.river});
  var activePlayers           = _.where(playingPlayers, {active: true});
  var inactiveAllInPlayer     = _.where(playingPlayers, {active: false, lastMove: stateOfX.move.allin});
  var foldedPlayers           = _.where(playingPlayers, {lastMove: stateOfX.move.fold});
  var winnerPlayerId          = null;

  serverLog(stateOfX.serverLogType.info, 'playingPlayers, activePlayers, inactiveAllInPlayer, foldedPlayers, disconnectedPlayers, disconnActivePlayers');
  serverLog(stateOfX.serverLogType.info, playingPlayers.length + ', ' + activePlayers.length + ', ' + inactiveAllInPlayer.length + ', ' + foldedPlayers.length+ ', ' + disconnectedPlayers.length+ ', ' + disconnActivePlayers.length);

  // Do not check ALLIN players length here as if they are there
  // This wouln't be the case for Game over with single winner
  if(playingPlayers.length - (foldedPlayers.length) <= 1) {
    serverLog(stateOfX.serverLogType.info, 'There is only one or less player left as active and for winner as well.');
    params.data.isSingleWinner = true;
    params.data.endingType     = playingPlayers.length === 1 ? stateOfX.endingType.onlyOnePlayerLeft : stateOfX.endingType.everybodyPacked;
  }
  // Decide winner and set single winner values
  if(params.data.isSingleWinner) {
    // Decide who is the last player left on the table
    
    // There is an active player left in the game 
    if(!winnerPlayerId && activePlayers.length > 0) {
      serverLog(stateOfX.serverLogType.info, 'Any active player will become winner!');
      for (var i = 0; i < activePlayers.length; i++) {
        if(activePlayers[i].lastMove !== stateOfX.move.fold) {
          serverLog(stateOfX.serverLogType.info, 'An active player is going to become winner! - ' + JSON.stringify(activePlayers[i]));
          winnerPlayerId = activePlayers[i].playerId;
          break;
        } else {
          serverLog(stateOfX.serverLogType.info, "This is a player with move " + activePlayers[i].lastMove + ", cannot be a winner!");
        }
      }
    }

    // There is no active players but an allin player
    if(!winnerPlayerId && inactiveAllInPlayer.length > 0) {
      serverLog(stateOfX.serverLogType.info, 'Last inactive but allin player is going to become winner! - ' + JSON.stringify(inactiveAllInPlayer));
      winnerPlayerId = inactiveAllInPlayer[0].playerId;
    }

    // If there is only one player and that too DISCONNCTED
    if(!winnerPlayerId && disconnectedPlayers.length === 1) {
      serverLog(stateOfX.serverLogType.info, 'Last disconnected player is going to become winner! - ' + JSON.stringify(disconnectedPlayers));
      winnerPlayerId = disconnectedPlayers[0].playerId;
    }

    // Handle disconnected player case
    if(!winnerPlayerId && disconnectedPlayers.length >= 1) {
      serverLog(stateOfX.serverLogType.info, 'Multiple disconnected player case, first in clockwise is going to become winner! - ' + JSON.stringify(disconnectedPlayers));
      winnerPlayerId = disconnectedPlayers[0].playerId;
    }

    if(!winnerPlayerId) {
      serverLog(stateOfX.serverLogType.error, 'No conadition handle for this type of game over!');
      serverLog(stateOfX.serverLogType.error, 'No conadition handle for this type of game over! Players are - ' + JSON.stringify(params.table.players));
      cb({success: false, channelId: params.channelId, isRetry: false, isDisplay: false, info: "Unable to perform game over, unable to decide !"});
      return false;
    }
//    console.error("!!!!!!!!!!!@@@@@@@###############",JSON.stringify(params));
    for(var i=0;i<params.table.pot.length;i++){
      params.data.winnerPlayerId = winnerPlayerId;
      params.data.winners.push({
        playerId    : winnerPlayerId,
        set         : [],
        type        : stateOfX.dealerChatReason[stateOfX.endingType.everybodyPacked],
        typeName    : stateOfX.dealerChatReason[stateOfX.endingType.everybodyPacked],
        amount      : 0,
        potIndex    : i,
        cardsToShow : null,
        isRefund    : false
      });

    }
    serverLog(stateOfX.serverLogType.info, 'Single winner case object: ' + JSON.stringify(params.data.winners));
    cb(null, params);
  } else {
  	serverLog(stateOfX.serverLogType.info, 'In this game the winner is not a single player, without comparing card, card will get compared!');
    cb(null, params);
  }
};

/////////////////////////////////////////////////////////
// <<<<<<<< GET SINGLE WINNER PLAYER ENDS >>>>>>>>>>>> //
/////////////////////////////////////////////////////////

// create winners response object
// that will render animation at client
// if rake deducted
var assignAmountIfRakeDeducted = function(params, cb) {
  async.eachSeries(params.data.winners, function(winner, ecb){
    serverLog(stateOfX.serverLogType.info, '1. Proessing winner for client response: ' + JSON.stringify(winner));
    winner.amount = params.rakeDetails.playerWins[winner.playerId];
    serverLog(stateOfX.serverLogType.info, 'Player total win for this table: ' + params.rakeDetails.playerWins[winner.playerId]);
    var playerIndex = _ld.findIndex(params.table.players, {playerId: winner.playerId});
    if(playerIndex >= 0) {
      winner.chips = params.table.players[playerIndex].chips;
    } else {
      serverLog(stateOfX.serverLogType.info, 'Player not present on table, not adding chips for client response!');   
    }
    ecb();
  }, function(err){
    if(err) {
      cb({success: false, channelId: params.channelId, isRetry: false, isDisplay: false, info: 'Creating response for winners has been failed!'});
    } else {
      serverLog(stateOfX.serverLogType.info, 'Updated winers for client response if rake deducted: ' + JSON.stringify(params.data.winners));
      // NOW client team needs all winners different for CHANGED ANIMATION
      // params.data.winners = _.unique(params.data.winners, 'playerId');
      serverLog(stateOfX.serverLogType.info, 'Removed duplicate entry of players in winners array: ' + JSON.stringify(params.data.winners));
      cb(null, params);
    }
  });
};

// create winners response object
// that will render animation at client
// if rake deducted
var assignAmountIfRakeNotDeducted = function(params, cb) {
  async.eachSeries(params.data.winners, function(winner, ecb){
    serverLog(stateOfX.serverLogType.info, 'Player win for this pot: ' + winner.amount); 
    var playerIndex = _ld.findIndex(params.table.players, {playerId: winner.playerId});
    if(playerIndex >= 0) {
      winner.chips = params.table.players[playerIndex].chips;
    } else {
      serverLog(stateOfX.serverLogType.info, 'Player not present on table, not adding chips for client response!');   
    }
    ecb();
  }, function(err){
    if(err) {
      cb({success: false, channelId: params.channelId, isRetry: false, isDisplay: false, info: 'Creating response for winners has been failed!'});
    } else {
      serverLog(stateOfX.serverLogType.info, 'Updated winers for client response if rake not deducted: ' + JSON.stringify(params.data.winners));
      cb(null, params);
    }
  });
};

// create winners response object
// that will render animation at client
module.exports.createWinnersForResponse = function(params, cb) {
	serverLog(stateOfX.serverLogType.info, 'In function createWinnersForResponse');
  if(Object.keys(params.rakeDetails.playerWins).length > 0) {
    serverLog(stateOfX.serverLogType.info, 'Rake has been deducted so calculating total table win from rake value!');
    assignAmountIfRakeDeducted(params, function(err, assignAmountIfRakeDeductedResponse){ cb(err, assignAmountIfRakeDeductedResponse) ;});
  } else {
    serverLog(stateOfX.serverLogType.info, 'Rake has not been deducted, calculating total win from winner (pot) amount!');
    assignAmountIfRakeNotDeducted(params, function(err, assignAmountIfRakeDeductedResponse){ cb(err, assignAmountIfRakeDeductedResponse); });
  }
};