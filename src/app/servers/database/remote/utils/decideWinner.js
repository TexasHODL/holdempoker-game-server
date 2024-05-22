/*jshint node: true */
"use strict";

var async        = require("async"),
    _ld          = require("lodash"),
    _            = require('underscore'),
    stateOfX     = require("../../../../../shared/stateOfX"),
    zmqPublish   = require("../../../../../shared/infoPublisher"),
    keyValidator = require("../../../../../shared/keysDictionary"),
    activity     = require("../../../../../shared/activity"),
    winnerMgmt   = require('../../../../../shared/winnerAlgo/entry'),
    db           = require("../../../../../shared/model/dbQuery"),
    tableManager = require("../tableManager"),
    deductRake   = require("./deductRake"),
    decideWinner = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'decideWinner';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  // zmqPublish.sendLogMessage(logObject);
  console.log(JSON.stringify(logObject));
}

function fixedDecimal(number, precisionValue) {
  let precision = precisionValue ? precisionValue : 2;
  return Number(Number(number).toFixed(precision));
}

// ### Validate if Game state in GAMEOVER throughout the calculation

var isGameProgress = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function isGameProgress');
  if(params.table.state === stateOfX.gameState.gameOver) {
    cb({success: true, isSingleWinner: params.data.isSingleWinner, winners: params.data.winners, endingType: params.data.endingType, params: params});
  } else {
    cb({success: false, info: "Game is not running on table !", isRetry: false, isDisplay: false, channelId: ""});
  }
};

// Pop board card for normal case
// remainingBoardCards = Number - how many cards to pop??
var popBoardCard = function (params, remainingBoardCards, cb) {
  var cards = params.table.deck.slice(0, remainingBoardCards);
  for (var i = 0; i < cards.length; i++) {
    params.table.boardCard[0].push(cards[i]);
    params.data.remainingBoardCards[0].push(cards[i]);
  }
  params.table.deck.splice(0, remainingBoardCards);
  cb(params);
};

// Pop board card in case of run-it-twice enabled by all players
// remainingBoardCards = Number - how many cards to pop??
var popRunItTwiceBoardCard = function (params, remainingBoardCards, cb) {
  if(params.table.isRunItTwiceApplied) {
    serverLog(stateOfX.serverLogType.info, 'Run it twice enabled on decideWinner pop card check!');
    serverLog(stateOfX.serverLogType.info, 'RIT enable, pop out ' + remainingBoardCards + ' RIT cards as well');
    var ritCards = params.table.deck.slice(0, remainingBoardCards);
    for (var j = 0; j < ritCards.length; j++) {
      params.table.boardCard[1].push(ritCards[j]);
      params.data.remainingBoardCards[1].push(ritCards[j]);
    }
    params.table.deck.splice(0, remainingBoardCards);
    cb(params);
  } else {
    serverLog(stateOfX.serverLogType.info, 'Run it twice not enabled yet on decideWinner pop card check!');
    cb(params);
  }
};

// ### Pop-out remaining board cards on table if required

var popRemainingBoardCards = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function popRemainingBoardCards');
  // Check the missing number of board cards
  var totalBoardcards = params.table.boardCard[0].length;
  serverLog(stateOfX.serverLogType.info, 'Total board card, already poped out: ' + totalBoardcards);
  var remainingBoardCards = 5 - totalBoardcards;
  serverLog(stateOfX.serverLogType.info, 'Remaining board cards to be poped out: s' + remainingBoardCards);

  // If there are still board cards needs to be pop out
  // Then fill those cards into board
  if(remainingBoardCards > 0) {
    serverLog(stateOfX.serverLogType.info, 'Number of cards to be poped out: ' + remainingBoardCards);
    serverLog(stateOfX.serverLogType.info, 'Board card on table pre: ' + JSON.stringify(params.table.boardCard));
    // Poped out remaining board cards
    popBoardCard(params, remainingBoardCards, function(popBoardCardResponse){
      // Poped out remaining board cards (in case of runintwice)
      popRunItTwiceBoardCard(params, remainingBoardCards, function(popRunItTwiceBoardCardResponse){
        serverLog(stateOfX.serverLogType.info, 'pBoard card on table post: ' + JSON.stringify(params.table.boardCard));
        cb(null, params);
      });
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'All the board cards have been popoed out - ' + JSON.stringify(params.table.boardCard));
    cb(null, params);
  }
};

// Store boardcards for comparision of winner
// runintwice cards can be - 
// card card card card card
// null null null null card
// null null null card card
// These null are adjusted here
var storeBoardCards = function (params) {
  // Store normal board cards
  for (var j = 0; j < params.table.boardCard[0].length; j++) {
    params.data.cardSets.boardCards[0].push({
      type : params.table.boardCard[0][j].type,
      rank : params.table.boardCard[0][j].rank
    });
  }

  // Store run it twice board cards
  for (var k = 0; k < params.table.boardCard[1].length; k++) {
    if(!!params.table.boardCard[1][k]) {
      params.data.cardSets.boardCards[1].push({
        type : params.table.boardCard[1][k].type,
        rank : params.table.boardCard[1][k].rank
      });
    } else {
      params.data.cardSets.boardCards[1].push({
        type : params.table.boardCard[0][k].type,
        rank : params.table.boardCard[0][k].rank
      });
    }
  }
  return;
};

// Store player cards for comparision of winner

var storePlayerCards = function (params) {
  var playingPlayers = [];
  for (var i = 0; i < params.table.players.length; i++) {
    if (params.table.onStartPlayers.indexOf(params.table.players[i].playerId)>=0) {
      playingPlayers.push(params.table.players[i]);
    }
  }
  // var playingPlayers = _.where(params.table.players, {state: stateOfX.playerState.playing})
  // var disconnectedPlayers     = _.where(params.table.players, {state: stateOfX.playerState.disconnected});
  // var disconnActivePlayers    = _.where(disconnectedPlayers, {lastRoundPlayed: stateOfX.round.river});
  // playingPlayers = playingPlayers.concat(disconnActivePlayers);

  serverLog(stateOfX.serverLogType.info, 'Players to store cardset:' + JSON.stringify(playingPlayers));

  for (var k = 0; k < playingPlayers.length; k++) {
    var cards = [];
    for (var l = 0; l < playingPlayers[k].cards.length; l++) {
      cards.push({
        type : playingPlayers[k].cards[l].type,
        rank : playingPlayers[k].cards[l].rank
      });
    }
    params.data.cardSets.playerCards.push({
      playerId: playingPlayers[k].playerId,
      cards: cards
    });
  }
  return;
};

// ### Store board and player cards combination
// > In order to decide winner on table

var storeCardSets = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function storeCardSets' + JSON.stringify(params));
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success) {
      if(!isGameProgressResponse.isSingleWinner) {
        params.data.cardSets = {};
        params.data.cardSets.playerCards = [];
        params.data.cardSets.boardCards = [[], []];

        // Store board cards
        storeBoardCards(params);

        // Store player cards
        storePlayerCards(params);

        serverLog(stateOfX.serverLogType.info, 'Updated players cards sets: ' + JSON.stringify(params.data.cardSets));

        cb(null, params);
      } else {
        cb(null, params);
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// Get winers rank from winning algo
var getWinnerRaking = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, "params is in get winnerRanking " + JSON.stringify(params));
  var playerCards       = [];
  var normalBoardInputs = {};
  var ritBoardInputs    = {};

  // Get unique contributors for all pots
  // var playingPlayers = _.where(params.table.players, {state: stateOfX.playerState.playing});
  var playingPlayers = [];
  for (var i = 0; i < params.table.players.length; i++) {
    if (params.table.onStartPlayers.indexOf(params.table.players[i].playerId)>=0) {
      playingPlayers.push(params.table.players[i]);
    }
  }
  serverLog(stateOfX.serverLogType.info, "playingPlayers are in get winnerRanking " + JSON.stringify(playingPlayers));
  // Make sure player is still active in the game (Not FOLDED / Not Left)
  // Store player cards
  var player = null;
  var playerCard = [];
  for (var i = 0; i < playingPlayers.length; i++) {
    player = playingPlayers[i];
    serverLog(stateOfX.serverLogType.info, 'Processing player while setting player cards for comparision: ' + JSON.stringify(player));
    if(player.lastMove !== stateOfX.move.fold) {
      if(player.state === stateOfX.playerState.playing || player.state === stateOfX.playerState.disconnected) {
        playerCard = _.where(params.data.cardSets.playerCards, {playerId: player.playerId})[0];
        serverLog(stateOfX.serverLogType.info, 'Player ' + player.playerName + ' with state ' + player.state + ', cards is going to be considered for comparision!'+ JSON.stringify(playerCard));
        // params.data.decisionParams[params.data.decisionParams.length-1].playerCards.push(playerCard);
        playerCards.push(playerCard);
      }
    } else {
      serverLog(stateOfX.serverLogType.info, 'Player ' + player.playerName + ' has last move: ' + player.lastMove + ', so skipping this player card for comparision!');
    }
  }
  serverLog(stateOfX.serverLogType.info, "Updated player cards: " + JSON.stringify(playerCards));

  // Create inputs for normal and RIT borad cards
  normalBoardInputs = {
    playerCards: playerCards,
    boardCards: params.table.boardCard[0]
  };

  serverLog(stateOfX.serverLogType.info, "Card sets for winning rank: " + JSON.stringify(normalBoardInputs));
  var tempRitCards = Array.from(params.table.boardCard[1]);
  serverLog(stateOfX.serverLogType.info, "tempRitCards before adjust " + JSON.stringify(tempRitCards));
  if(params.table.isRunItTwiceApplied) {
    for(var i=0;i<params.table.boardCard[0].length;i++) {
      if(tempRitCards[i] === null) {
        tempRitCards[i] = params.table.boardCard[0][i];
      }
    }
    serverLog(stateOfX.serverLogType.info, "tempRitCards after adjust " + JSON.stringify(tempRitCards));
    params.data.tempRitBoardCards = tempRitCards;
    ritBoardInputs = {
      playerCards: playerCards,
      boardCards: tempRitCards
    };
    serverLog(stateOfX.serverLogType.info, "Card sets for winning rank in RIT: " + JSON.stringify(ritBoardInputs));
  }

  // Store boardcards bases on normal and RIT games
  switch(params.table.channelVariation) {
    case stateOfX.channelVariation.holdem     : params.data.winnerRanking = winnerMgmt.findWinner(normalBoardInputs); break;
    case stateOfX.channelVariation.omaha      : params.data.winnerRanking = winnerMgmt.findWinnerOmaha(normalBoardInputs); break;
    case stateOfX.channelVariation.omahahilo  : params.data.winnerRanking = winnerMgmt.findWinnerOmahaHiLo(normalBoardInputs); break;
    default                                   : serverLog(stateOfX.serverLogType.error, 'No case handle for variation - ' + params.table.channelVariation); break;
  }
  serverLog(stateOfX.serverLogType.info, "Ranking for normal board set: " + JSON.stringify(params.data.winnerRanking));
  
  // Get winnners for normal and RIT game using algo
  if(params.table.isRunItTwiceApplied) {

    switch(params.table.channelVariation) {
      case stateOfX.channelVariation.holdem     : params.data.ritWinnerRanking = winnerMgmt.findWinner(ritBoardInputs); break;
      case stateOfX.channelVariation.omaha      : params.data.ritWinnerRanking = winnerMgmt.findWinnerOmaha(ritBoardInputs); break;
      case stateOfX.channelVariation.omahahilo  : params.data.ritWinnerRanking = winnerMgmt.findWinnerOmahaHiLo(ritBoardInputs); break;
      default                                   : serverLog(stateOfX.serverLogType.error, 'No case handle for variation - ' + params.table.channelVariation); break;
    }
    serverLog(stateOfX.serverLogType.info, "Ranking for RIT board set 2: " + JSON.stringify(params.data.ritWinnerRanking));
  }
  
  cb(null, params);
};

// Set player cards for any decision params generated for a pot

// Check if player still exists on table (Didn't left the game)
// Do not consider playerCards for player with last move fold
// Consider disconnected player as well if player played till round RIVER

var setPlayerCardForDecisionParam = function(params, pot){
  serverLog(stateOfX.serverLogType.info, 'In function setPlayerCardForDecisionParam.');
  var player = null;
  var playerCard = [];
  for (var i = 0; i < pot.contributors.length; i++) {
    var playerIndex = _ld.findIndex(params.table.players, {playerId: pot.contributors[i]});
    serverLog(stateOfX.serverLogType.info, 'Player index for player in order to decide player cards for comparision: ' + playerIndex);
    if(playerIndex >= 0) {      
      player = params.table.players[playerIndex];
      serverLog(stateOfX.serverLogType.info, 'Processing player while setting player cards for comparision: ' + JSON.stringify(player));
      if(player.lastMove !== stateOfX.move.fold) {
        if(player.state === stateOfX.playerState.playing || player.state === stateOfX.playerState.disconnected) {
          playerCard = _.where(params.data.cardSets.playerCards, {playerId: pot.contributors[i]})[0];
          serverLog(stateOfX.serverLogType.info, 'Player ' + player.playerName + ' with state ' + player.state + ', cards is going to be considered for comparision!');
          params.data.decisionParams[params.data.decisionParams.length-1].playerCards.push(playerCard);
        }
      } else {
        serverLog(stateOfX.serverLogType.info, 'Player ' + player.playerName + ' has last move: ' + player.lastMove + ', so skipping this player card for comparision!');
      }


      // if(() && ) {
      //   var playerCard = _.where(params.data.cardSets.playerCards, {playerId: pot.contributors[i]})[0];
      //   serverLog(stateOfX.serverLogType.info, 'Cards for this player: ' + JSON.stringify(playerCard));
      //   params.data.decisionParams[params.data.decisionParams.length-1].playerCards.push(playerCard);
      // } else {
      //   serverLog(stateOfX.serverLogType.info, 'Skipping player ' + params.table.players[playerIndex].playerName + ' state - ' + params.table.players[playerIndex].state + ' and last move - ' + params.table.players[playerIndex].lastMove + ' from contributors')
      // }
    } else {
      serverLog(stateOfX.serverLogType.info, 'This player ' + pot.contributors[i] + ' is no more on the table, skipping this player card for comparision!');
    }
  }
};

// ### Generate player and board cards as per number of pots and contributors

var generateDecisionParams = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function generateDecisionParams');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success) {
      if(!isGameProgressResponse.isSingleWinner) {
        serverLog(stateOfX.serverLogType.info, '--------- Pot while setting decision params ------------');
        serverLog(stateOfX.serverLogType.info, JSON.stringify(params.data.pot));
        async.eachSeries(params.data.pot, function (pot, escb) {

          serverLog(stateOfX.serverLogType.info, 'Generating decision params for pot - ' + JSON.stringify(pot));
          params.data.decisionParams.push({
            boardCards            : params.data.cardSets.boardCards[pot.borardSet],
            playerCards           : [],
            amount                : pot.amount,
            potIndex              : pot.potIndex,
            winners               : [],
            winningAmount         : 0,
            isRit                 : pot.borardSet === 1, 
            isRefund              : pot.isRefund, 
            internalPotSplitIndex : pot.internalPotSplitIndex,
            contributors          : pot.contributors
          });

          setPlayerCardForDecisionParam(params, pot);
          
          escb();
        }, function (err) {
          if(err) {
            serverLog(stateOfX.serverLogType.error, 'Generating params for winner failed!');
            cb({success: false, info: 'Generating params for winner failed!',isRetry: false, isDisplay: false, channelId: ""});
          } else {
            serverLog(stateOfX.serverLogType.info, 'Decision params for deciding winner will be: ' + JSON.stringify(params.data.decisionParams));
            cb(null, params);
          }
        });
      } else {
        cb(null, params);
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// filters winners if not contributors
function differenceBy(arr1, arr2, key){
  var arr = [];
  for (var i = 0; i < arr1.length; i++) {
    var filter = {};
    filter[key] = arr1[i][key];
    // findWhere second arg is like: {playerId: 'asdasd2r23r'}
    if(_.findWhere(arr2, filter)){
      arr.push(arr1[i]);
    }
  }
  return arr;
}

// find winners for each pot for holdem and omaha
var extractWinners = function(contributors, winnerRanking,indexOfPots) {
  var sortedWinnerRanking = _.sortBy(winnerRanking,"winnerRank");
  var tempWinner;
  serverLog(stateOfX.serverLogType.info, 'winnerRanking  is - ' + JSON.stringify(sortedWinnerRanking));
  serverLog(stateOfX.serverLogType.info, 'contributors  is - ' + JSON.stringify(contributors));
  var isFound = false;
  for(var i=0; i<sortedWinnerRanking.length && !isFound;i++) {
    for(var j=0;j<contributors.length && !isFound;j++) {
      if(sortedWinnerRanking[i].playerId.toString() == contributors[j].playerId.toString()) {
        tempWinner = sortedWinnerRanking[i];
        isFound = true;
      }
    }
  }
  serverLog(stateOfX.serverLogType.info, 'tempWinner  is - ' + JSON.stringify(tempWinner));
  var finalWinner = _.where(sortedWinnerRanking,{winnerRank : tempWinner.winnerRank});
  serverLog(stateOfX.serverLogType.info, 'final winner partial is - ' + JSON.stringify(finalWinner));
  finalWinner = differenceBy(finalWinner, contributors, 'playerId');
  serverLog(stateOfX.serverLogType.info, 'final winner is - ' + JSON.stringify(finalWinner));
  return finalWinner;
};

// find winners for each pot for omaha-hilo
var extractWinnersOmahaHiLo = function(contributors, winnerRanking,indexOfPots) {
  var sortedWinnerHighRanking = _.sortBy(winnerRanking.winnerHigh,"winnerRank");
  var sortedWinnerLoRanking = _.sortBy(winnerRanking.winnerLo,"winnerRank");
  var tempWinnerHigh, tempWinnerLo, findWinnerLo = [];
  serverLog(stateOfX.serverLogType.info, 'winnerRanking  is - ' + JSON.stringify(winnerRanking));
  serverLog(stateOfX.serverLogType.info, 'contributors  is - ' + JSON.stringify(contributors));
  serverLog(stateOfX.serverLogType.info, 'sortedWinnerHighRanking  is - ' + JSON.stringify(sortedWinnerHighRanking));
  serverLog(stateOfX.serverLogType.info, 'sortedWinnerLoRanking  is - ' + JSON.stringify(sortedWinnerLoRanking));
  loopHighLabel:
  for(var i=0; i<sortedWinnerHighRanking.length;i++) {
    for(var j=0;j<contributors.length;j++) {
      if(sortedWinnerHighRanking[i].playerId.toString() == contributors[j].playerId.toString()) {
        tempWinnerHigh = sortedWinnerHighRanking[i];
        break loopHighLabel;
      }
    }
  }
  serverLog(stateOfX.serverLogType.info, 'tempWinnerHigh  is - ' + JSON.stringify(tempWinnerHigh));
  if(sortedWinnerLoRanking.length > 0){
    loopLoLabel:
    for(var i=0; i<sortedWinnerLoRanking.length;i++) {
      for(var j=0;j<contributors.length;j++) {
        if(sortedWinnerLoRanking[i].playerId.toString() == contributors[j].playerId.toString()) {
          tempWinnerLo = sortedWinnerLoRanking[i];
          break loopLoLabel;
        }
      }
    }
    serverLog(stateOfX.serverLogType.info, 'tempWinnerLo  is - ' + JSON.stringify(tempWinnerLo));
    if(!!tempWinnerLo) {
      findWinnerLo = _.where(sortedWinnerLoRanking,{winnerRank : tempWinnerLo.winnerRank});
      findWinnerLo = differenceBy(findWinnerLo, contributors, 'playerId');
    }
  }
  var winnerHigh = _.where(sortedWinnerHighRanking,{winnerRank : tempWinnerHigh.winnerRank});
  winnerHigh = differenceBy(winnerHigh, contributors, 'playerId');
  var finalWinner = {
    winnerHigh : winnerHigh,
    winnerLo : findWinnerLo
  };
  serverLog(stateOfX.serverLogType.info, 'final winner is - ' + JSON.stringify(finalWinner));
  return finalWinner;
};

// ### Decide winner based on Game type

var decidewinner = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function decidewinner');
  serverLog(stateOfX.serverLogType.info, 'params in decideWinner function decidewinner' + JSON.stringify(params));
  isGameProgress(params, function(isGameProgressResponse){
    serverLog(stateOfX.serverLogType.info, 'params.data.decisionParams - ' + JSON.stringify(params.data.decisionParams));
    if(isGameProgressResponse.success) {
      if(!isGameProgressResponse.isSingleWinner) {
        serverLog(stateOfX.serverLogType.info, 'Deciding winner for variaton - ' + params.table.channelVariation + ', not a single winner case!');
        async.eachSeries(params.data.decisionParams, function (decisionSet, ecb) {

          // Get winner based on decision params generated previously
          serverLog(stateOfX.serverLogType.info, 'Processing decision set: ' + JSON.stringify(decisionSet));
          var tempWinnerSet = decisionSet.isRit ? params.data.ritWinnerRanking : params.data.winnerRanking; 
          // Decide winner based on Channel/Table variation
          switch(params.table.channelVariation) {
            case stateOfX.channelVariation.holdem     : decisionSet.winners = extractWinners(decisionSet.playerCards,tempWinnerSet,decisionSet.internalPotSplitIndex); break;
            case stateOfX.channelVariation.omaha      : decisionSet.winners = extractWinners(decisionSet.playerCards,tempWinnerSet,decisionSet.internalPotSplitIndex); break;
            case stateOfX.channelVariation.omahahilo  : decisionSet.winners = extractWinnersOmahaHiLo(decisionSet.playerCards,tempWinnerSet,decisionSet.internalPotSplitIndex); break;
            default                                   : serverLog(stateOfX.serverLogType.error, 'No case handle for variation - ' + params.table.channelVariation); break;
          }
          if(params.table.channelVariation != stateOfX.channelVariation.omahahilo) {
            serverLog(stateOfX.serverLogType.info, '--------- Winners for current decision set from algo ' + decisionSet.winners.length + '---------');
            serverLog(stateOfX.serverLogType.info, 'Winners are: ' + JSON.stringify(decisionSet.winners));
          } else {
            serverLog(stateOfX.serverLogType.info, '--------- Winners for current decision set from algo ---------');
            serverLog(stateOfX.serverLogType.info, 'Hi Winners are: ' + JSON.stringify(decisionSet.winners.winnerHigh));
            serverLog(stateOfX.serverLogType.info, 'Low Winners are: ' + JSON.stringify(decisionSet.winners.winnerLo));
          }

          ecb();
        }, function (err) {
          if(err) {
            serverLog(stateOfX.serverLogType.error, 'Deciding winner failed! - ' + JSON.stringify(err));
            cb({success: false, channelId: params.channelId, info: 'Deciding winner failed! - ' + JSON.stringify(err),isRetry: false, isDisplay: false});
          } else {
        console.error("@@@@@@@@@@@@@@@@@@@@@@@@");
        console.error(JSON.stringify(params));
            serverLog(stateOfX.serverLogType.info, 'All winners found and updated decision params: ' + JSON.stringify(params.data.decisionParams));
            params.data.boardCard = params.table.boardCard;
            cb(null, params);
          }
        });
      } else {
        serverLog(stateOfX.serverLogType.info, 'Skipping getting winner from algo, as this is single player winner case !!');
        cb(null, params);
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// Add winning factor text for winner players

var refineDecisionParams = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function refineDecisionParams');
  if(params.table.channelVariation !== stateOfX.channelVariation.omahahilo) {
    serverLog(stateOfX.serverLogType.info, 'Resetting winning text for variation: ' + params.table.channelVariation);
    async.eachSeries(params.data.decisionParams, function (decisionSet, ecb) {
      async.each(decisionSet.winners, function(winner, escb){
        winner.winningAmount = 0;
        // var winnerCards = _.where(decisionSet.playerCards, {playerId: winner.playerId})[0].cards;
        // var dataSet = {boardCards: decisionSet.boardCards, playerCards: [{playerId: winner.playerId, cards: winnerCards}]};
        // serverLog(stateOfX.serverLogType.info, 'Winning type text response from algo: ' + JSON.stringify(winnerMgmt.findCardsConfiguration(dataSet, params.table.channelVariation)))
        // winner.type = winnerMgmt.findCardsConfiguration(dataSet, params.table.channelVariation)[0].text;
        // winner.type = winner.text; // TODO - type and texts are needs to be different
        // delete winner.set;
        delete winner.typeName;
        serverLog(stateOfX.serverLogType.info, 'Updated winners are: ' + JSON.stringify(decisionSet.winners));
        escb();
      }, function(err) {
        if(err) {
          serverLog(stateOfX.serverLogType.error, '1. Adding winning type text failed for variation: ' + params.table.channelVariation);
          cb({success: false, channelId: params.channelId, info: "Adding winning type text failed!", isRetry: false, isDisplay: false});
        } else {
          ecb();
        }
      });
    }, function(err) {
      if(err) {
        serverLog(stateOfX.serverLogType.error, '2. Adding winning type text failed for variation: ' + params.table.channelVariation);
        cb({success: false, channelId: params.channelId, info: "Adding winning type text failed!", isRetry: false, isDisplay: false});
      } else {
        serverLog(stateOfX.serverLogType.info, 'Decision params after updating winning text: ' + JSON.stringify(params.data.decisionParams));
        cb(null, params);
      }
    });
  } else {
    async.eachSeries(params.data.decisionParams, function (decisionSet, ecb) {

      serverLog(stateOfX.serverLogType.info, 'decisionSet: ' + JSON.stringify(decisionSet));

      async.each(decisionSet.winners.winnerHigh, function(winner, escb){
        // console.log("winnners card - "+ JSON.stringify(_.where(decisionSet.playerCards, {playerId: winner.playerId})));
        // var winnerCards = _.where(decisionSet.playerCards, {playerId: winner.playerId})[0].cards;
        // var dataSet = {boardCards: decisionSet.boardCards, playerCards: [{playerId: winner.playerId, cards: winnerCards}]};
        // console.log('dataSet: ' + JSON.stringify(dataSet))
        // serverLog(stateOfX.serverLogType.info, 'HI: Winning type text response from algo: ' + JSON.stringify(winnerMgmt.findCardsConfiguration(dataSet, params.table.channelVariation)))
        // winner.type = winnerMgmt.findCardsConfiguration(dataSet, params.table.channelVariation)[0].winnerHigh[0].text;
        // winner.type = winner.text; // TODO - type and texts are needs to be different
        // delete winner.set;
        delete winner.typeName;
        serverLog(stateOfX.serverLogType.info, 'HI: Updated winners are: ' + JSON.stringify(decisionSet.winners));
        escb();
      }, function(err) {
        if(err) {
          serverLog(stateOfX.serverLogType.error, 'HI: Adding winning type text failed for variation: ' + params.table.channelVariation + ' and HI winners!');
          cb({success: false, channelId: params.channelId, info: "Adding winning type text failed, winner hi!", isRetry: false, isDisplay: false});
        } else {
          async.each(decisionSet.winners.winnerLo, function(winner, escb){
            // var winnerCards = _.where(decisionSet.playerCards, {playerId: winner.playerId})[0].cards;
            // var dataSet = {boardCards: decisionSet.boardCards, playerCards: [{playerId: winner.playerId, cards: winnerCards}]};
            // serverLog(stateOfX.serverLogType.info, 'LO: Winning type text response from algo: ' + JSON.stringify(winnerMgmt.findCardsConfiguration(dataSet, params.table.channelVariation)))
            // winner.type = winnerMgmt.findCardsConfiguration(dataSet, params.table.channelVariation)[0].winnerLo[0].text;
            // winner.type = winner.text; // TODO - type and texts are needs to be different
            // delete winner.set;
            delete winner.typeName;
            serverLog(stateOfX.serverLogType.info, 'LO: Updated winners are: ' + JSON.stringify(decisionSet.winners));
            escb();
          }, function(err) {
            if(err) {
              serverLog(stateOfX.serverLogType.error, 'LO: Adding winning type text failed for variation: ' + params.table.channelVariation + ' and LO winners!');
              cb({success: false, channelId: params.channelId, info: "Adding winning type text failed, winner lo!", isRetry: false, isDisplay: false});
            } else {
              ecb();
            }
          });
        }
      });
    }, function(err) {
      if(err) {
        serverLog(stateOfX.serverLogType.error, '3. Adding winning type text failed for variation: ' + params.table.channelVariation);
        cb({success: false, channelId: params.channelId, info: "Adding winning type text failed!", isRetry: false, isDisplay: false});
      } else {
        console.error("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        console.error(JSON.stringify(params));
        serverLog(stateOfX.serverLogType.info, 'Decision params after updating winning text: ' + JSON.stringify(params.data.decisionParams));
        cb(null, params);
      }
    });
  }
};

// ### Add winning amount for Holdem and Omaha
// > The cases are same for both variations
// > POTINDEX is adding here in each winners array

var addWinningAmount = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function addWinningAmount');
  isGameProgress(params, function(isGameProgressResponse){

    if(isGameProgressResponse.isSingleWinner) {
      serverLog(stateOfX.serverLogType.info, 'Not adding amount here for single winner');
      cb(null, params);
      return;
    }

    if(params.table.channelVariation === stateOfX.channelVariation.omahahilo) {
      serverLog(stateOfX.serverLogType.info, 'Skipping winner amount here as game variation - ' + params.table.channelVariation);
      cb(null, params);
      return;
    }
      console.error("**********************************************");
        console.error(JSON.stringify(params));
//        console.error('============--------------',JSON.stringify(params));
    async.eachSeries(params.data.decisionParams, function (decisionSet, ecb) {
      // Get winner based on decision params generated previously
      serverLog(stateOfX.serverLogType.info, '------------addWinningAmount decisionSet---------------');
      serverLog(stateOfX.serverLogType.info, JSON.stringify(decisionSet));
      var winningAmount = decisionSet.amount;

      // Adjust winners array for response to client - Add additional keys
      var clonedDesicionParams = JSON.parse(JSON.stringify(decisionSet.winners));
      for (var i = 0; i < clonedDesicionParams.length; i++) {
        // decisionSet.winners[i].potIndex = decisionSet.potIndex;
        clonedDesicionParams[i].potIndex = decisionSet.potIndex;

        // decisionSet.winners[i].amount   = winningAmount / clonedDesicionParams.length;
        clonedDesicionParams[i].amount   = winningAmount / clonedDesicionParams.length;
        
        // decisionSet.winners[i].amount   = Math.round(clonedDesicionParams[i].amount);
        // clonedDesicionParams[i].amount   = Math.round(clonedDesicionParams[i].amount); // for decimal values commented - Digvijay
        clonedDesicionParams[i].amount   = fixedDecimal(clonedDesicionParams[i].amount, 2);
        
        // decisionSet.winners[i].internalPotSplitIndex = decisionSet.internalPotSplitIndex;
        clonedDesicionParams[i].internalPotSplitIndex = decisionSet.internalPotSplitIndex;
        
        // decisionSet.winners[i].isRefund = decisionSet.isRefund;
        clonedDesicionParams[i].isRefund = decisionSet.isRefund;
        
        // decisionSet.winners[i].isRit = decisionSet.isRit;
        clonedDesicionParams[i].isRit = decisionSet.isRit;


        decisionSet.winners[i] = clonedDesicionParams[i]; // STORY - cloning was needed due to 
        // objects being used by reference
        // and winners objects overwriting each other

        params.data.winners.push(clonedDesicionParams[i]);
      }
      serverLog(stateOfX.serverLogType.info, 'Updated winners after adding winning amount - ' + JSON.stringify(decisionSet.winners));
      ecb();
    }, function (err) {
      if(err) {
        cb({success: false, info: 'Getting winner failed! - ' + err, isRetry: false, isDisplay: false, channelId: ""});
      } else {
        params.data.boardCard = params.table.boardCard;
//        console.error('============--------------',JSON.stringify(params));
        cb(null, params);
      }
    });
  });
};

// ### Add winning amount for Omaha-HiLo
// POTINDEX is adding here in each winners array

var addWinningAmountOmahaHiLo = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function addWinningAmountOmahaHiLo');
  isGameProgress(params, function(isGameProgressResponse){

    if(isGameProgressResponse.isSingleWinner) {
      serverLog(stateOfX.serverLogType.info, 'Not adding amount here for single winner');
      cb(null, params);
      return;
    }

    if(params.table.channelVariation !== stateOfX.channelVariation.omahahilo) {
      serverLog(stateOfX.serverLogType.info, 'Skipping winner amount here as game variation - ' + params.table.channelVariation);
      cb(null, params);
      return;
    }
        console.error("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
        console.error(JSON.stringify(params));
    async.eachSeries(params.data.decisionParams, function (decisionSet, ecb) {
      // Get winner based on decision params generated previously
      serverLog(stateOfX.serverLogType.info, '------------addWinningAmountOmahaHiLo decisionSet---------------');
//      console.error(stateOfX.serverLogType.info, JSON.stringify(decisionSet));
      var winningAmount = decisionSet.amount;

      // Adjust winners array for response to client - Add additional keys
        var clonedDesicionParams = JSON.parse(JSON.stringify(decisionSet.winners));
        console.error("!!!!!!!!!!!!!!!!!!!!!!!");
        console.error(JSON.stringify(clonedDesicionParams));
      if(clonedDesicionParams.winnerLo.length > 0) {
        serverLog(stateOfX.serverLogType.info, 'There are winners for Lo as well, distribute amount accordingly.');
        for (var i = 0; i < clonedDesicionParams.winnerHigh.length; i++) {
          clonedDesicionParams.winnerHigh[i].potIndex = decisionSet.potIndex;
          clonedDesicionParams.winnerHigh[i].amount   = winningAmount / (2*clonedDesicionParams.winnerHigh.length);
          // clonedDesicionParams.winnerHigh[i].amount   = Math.round(clonedDesicionParams.winnerHigh[i].amount);
          clonedDesicionParams.winnerHigh[i].amount   = fixedDecimal(clonedDesicionParams.winnerHigh[i].amount, 2);
          clonedDesicionParams.winnerHigh[i].internalPotSplitIndex = decisionSet.internalPotSplitIndex + "0";
          clonedDesicionParams.winnerHigh[i].isRefund = decisionSet.isRefund;
          clonedDesicionParams.winnerHigh[i].isRit = decisionSet.isRit;
          params.data.winners.push(clonedDesicionParams.winnerHigh[i]);
        }

        for (var j = 0; j < clonedDesicionParams.winnerLo.length; j++) {
          clonedDesicionParams.winnerLo[j].potIndex = decisionSet.potIndex;
          clonedDesicionParams.winnerLo[j].amount   = winningAmount / (2*clonedDesicionParams.winnerLo.length);
          // clonedDesicionParams.winnerLo[j].amount   = Math.round(clonedDesicionParams.winnerLo[j].amount);
          clonedDesicionParams.winnerLo[j].amount   = fixedDecimal(clonedDesicionParams.winnerLo[j].amount, 2);
          clonedDesicionParams.winnerLo[j].internalPotSplitIndex = decisionSet.internalPotSplitIndex + "1";
           clonedDesicionParams.winnerLo[j].isRefund = decisionSet.isRefund;
           clonedDesicionParams.winnerLo[j].isRit = decisionSet.isRit;
          params.data.winners.push(clonedDesicionParams.winnerLo[j]);
        }

         // decisionSet.winners = clonedDesicionParams;
        serverLog(stateOfX.serverLogType.info, 'Updated winners after adding winning amount - ' + JSON.stringify(clonedDesicionParams));
      } else {
        serverLog(stateOfX.serverLogType.info, 'There are no winners for LO, all amount for HI win players');
        for (var k = 0; k < clonedDesicionParams.winnerHigh.length; k++) {
          clonedDesicionParams.winnerHigh[k].potIndex = decisionSet.potIndex;
          clonedDesicionParams.winnerHigh[k].amount   = winningAmount / clonedDesicionParams.winnerHigh.length;
          // clonedDesicionParams.winnerHigh[k].amount   = Math.round(clonedDesicionParams.winnerHigh[k].amount);
          clonedDesicionParams.winnerHigh[k].amount   = fixedDecimal(clonedDesicionParams.winnerHigh[k].amount, 2);
          clonedDesicionParams.winnerHigh[k].internalPotSplitIndex = decisionSet.internalPotSplitIndex + "0";
          clonedDesicionParams.winnerHigh[k].isRefund = decisionSet.isRefund;
          clonedDesicionParams.winnerHigh[k].isRit = decisionSet.isRit;
          params.data.winners.push(clonedDesicionParams.winnerHigh[k]);
        }

         // decisionSet.winners = clonedDesicionParams;
        serverLog(stateOfX.serverLogType.info, 'Updated winners after adding winning amount - ' + JSON.stringify(clonedDesicionParams));
      }
        console.error("!!!!!!!!!!!!!!!!!!!!!!!");
        console.error(JSON.stringify(clonedDesicionParams));
       decisionSet.winners = clonedDesicionParams;
      ecb();
    }, function (err) {
      if(err) {
        cb({success: false, channelId: params.channelId, info: 'Getting winner failed! - ' + err, isRetry: false, isDisplay: false});
      } else {
        params.data.boardCard = params.table.boardCard;
        cb(null, params);
      }
    });
  });
};

// Intitialize params for the calculation of winner decision
var initializeParams = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function initializeParams');
  params.data.cardsToShow = {};
  params.data.winners     = [];
  params.table.roundName  = stateOfX.round.showdown;
  cb(null, params);
};

// ### Deduct rake on this table

var deductRakeOnTable = function (params, cb) {
  //console.error("&&&&&&&&&&&&&&&&&&&&####################%%%%%%%%%%%%%",JSON.stringify(params));
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function deductRakeOnTable');
  deductRake.deductRakeOnTable(params, function(deductRakeOnTableResponse) {
    serverLog(stateOfX.serverLogType.info, 'deductRakeOnTableResponse - ' + JSON.stringify(deductRakeOnTableResponse));
    if(deductRakeOnTableResponse.success) {
      cb(null, deductRakeOnTableResponse.params);
    } else {
      cb(deductRakeOnTableResponse);
    }
  });
};

// process winners by pot
// add winning amount
decideWinner.processWinnerDecision = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function processWinnerDecision');
  async.waterfall([

    async.apply(initializeParams,params),
    popRemainingBoardCards,
    storeCardSets,
    getWinnerRaking,
    generateDecisionParams,
    decidewinner,
    refineDecisionParams,
    deductRakeOnTable,
    addWinningAmount,
    addWinningAmountOmahaHiLo

  ],function(err, params){
    if(err) {
      // activity.potWinner(err,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.info,stateOfX.logType.error);
      cb(err);
    } else {
      console.error("!!!!!!!!!!!!!!!!!!!!!!!");
        console.error(JSON.stringify(params));
      // activity.potWinner(params,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.info,stateOfX.logType.success);
      cb({success:true, params: params});
    }
  });
};

module.exports = decideWinner;
