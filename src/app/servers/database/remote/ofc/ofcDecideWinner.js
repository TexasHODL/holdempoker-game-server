/*jshint node: true */
"use strict";

var async        = require("async"),
    _ld          = require("lodash"),
    _            = require('underscore'),
    stateOfX     = require("../../../../../shared/stateOfX"),
    zmqPublish   = require("../../../../../shared/infoPublisher"),
    keyValidator = require("../../../../../shared/keysDictionary"),
    winnerMgmt   = require('../../../../../shared/winnerAlgo/entry'),
    db           = require("../../../../../shared/model/dbQuery"),
    tableManager = require("./ofcTableManager"),
    deductRake   = require("./ofcDeductRake"),
    decideWinner = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'decideWinner';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

// ### Validate if Game state in GAMEOVER throughout the calculation

var isGameProgress = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function isGameProgress');
  if(params.table.state === stateOfX.gameState.gameOver) {
    cb({success: true, isSingleWinner: params.data.isSingleWinner, winners: params.data.winners, endingType: params.data.endingType, params: params});
  } else {
    cb({success: false, info: "Game is not running on table !"});
  }
};

// Pop board card for normal case

var popBoardCard = function (params, remainingBoardCards, cb) {
  serverLog(stateOfX.serverLogType.info, 'Deck - ' + JSON.stringify(params.table.deck)); 
  var cards = params.table.deck.slice(0, remainingBoardCards);
  for (var i = 0; i < cards.length; i++) {
    params.table.boardCard[0].push(cards[i]);
    params.data.remainingBoardCards[0].push(cards[i]);
  }
  params.table.deck.splice(0, remainingBoardCards);
  cb(params);
};

// Pop board card in case of run-it-twice enabled by all players

var popRunItTwiceBoardCard = function (params, remainingBoardCards, cb) {
  tableManager.isRunItTwice(params, function(isRunItTwiceResponse){ 
    if(isRunItTwiceResponse) {
      serverLog(stateOfX.serverLogType.info, 'Deck - ' + JSON.stringify(params.table.deck)); 
      serverLog(stateOfX.serverLogType.info, 'Run it twice enabled on round over check!');
      serverLog(stateOfX.serverLogType.info, 'RIT enable, pop out ' + remainingBoardCards + ' RIT cards as well');
      var ritCards = params.table.deck.slice(0, remainingBoardCards);
      for (var j = 0; j < ritCards.length; j++) {
        params.table.boardCard[1].push(ritCards[j]);
        params.data.remainingBoardCards[1].push(ritCards[j]);
      }
      params.table.deck.splice(0, remainingBoardCards);
      cb(params);
    } else {
      serverLog(stateOfX.serverLogType.info, 'Run it twice not enabled yet on round over check!');
      cb(params);
    }
  });
};

// ### Pop-out remaining board cards on table if required

var popRemainingBoardCards = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function popRemainingBoardCards');
  // Check the missing number of board cards
  var totalBoardcards = params.table.boardCard[0].length;
  serverLog(stateOfX.serverLogType.info, 'Total board card - ' + totalBoardcards);
  var remainingBoardCards = 5 - totalBoardcards;
  serverLog(stateOfX.serverLogType.info, 'Remaining board card - ' + remainingBoardCards);

  // If there are still board cards needs to be pop out
  // Then fill those cards into board
  if(remainingBoardCards > 0) {
    serverLog(stateOfX.serverLogType.info, 'cards to be poped out - ' + remainingBoardCards);
    serverLog(stateOfX.serverLogType.info, 'pre - ' + JSON.stringify(params.table.boardCard));
    // Poped out remaining board cards
    popBoardCard(params, remainingBoardCards, function(popBoardCardResponse){
      serverLog(stateOfX.serverLogType.info, 'Deck after normal pop - ' + JSON.stringify(popBoardCardResponse.table.deck)); 
      // Poped out remaining board cards (in case of runintwice)
      popRunItTwiceBoardCard(params, remainingBoardCards, function(popRunItTwiceBoardCardResponse){
        serverLog(stateOfX.serverLogType.info, 'Deck after rit pop - ' + JSON.stringify(popRunItTwiceBoardCardResponse.table.deck)); 
        serverLog(stateOfX.serverLogType.info, 'post - ' + JSON.stringify(params.table.boardCard));
        cb(null, params);
      });
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'All the board cards have been popoed out - ' + JSON.stringify(params.table.boardCard));
    cb(null, params);
  }
};

// Store boardcards for comparision of winner

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

  // for (var i = 0; i < params.table.boardCard.length; i++) {
  //   if (params.table.boardCard[i].length > 0) {
  //     for (var j = 0; j < params.table.boardCard[i].length; j++) {
  //       params.data.cardSets.boardCards[i].push({
  //         type : params.table.boardCard[i][j].type,
  //         rank : params.table.boardCard[i][j].rank
  //       })
  //     };
  //   }
  // };
  
  return;
};

// Store player cards for comparision of winner

var storePlayerCards = function (params) {
  var playingPlayers = _.where(params.table.players, {state: stateOfX.playerState.playing});
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
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function storeCardSets');
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

        cb(null, params);
      } else {
        cb(null, params);
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Generate player and board cards as per number of pots and contributors

var generateDecisionParams = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function generateDecisionParams');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success) {
      if(!isGameProgressResponse.isSingleWinner) {
        serverLog(stateOfX.serverLogType.info, '--------- Pot while deciding winner ------------');
        serverLog(stateOfX.serverLogType.info, JSON.stringify(params.data.pot));
        async.eachSeries(params.data.pot, function (pot, escb) {
          
          serverLog(stateOfX.serverLogType.info, 'Generating decision params for pot - ' + JSON.stringify(pot));
          serverLog(stateOfX.serverLogType.info, 'Pot index for this pot - ' + pot.potIndex);

          params.data.decisionParams.push({
            boardCards      : params.data.cardSets.boardCards[pot.borardSet],
            playerCards     : [],
            amount          : pot.amount,
            potIndex        : pot.potIndex,
            winners         : [],
            winningAmount   : 0,
          });
          
          for (var i = 0; i < pot.contributors.length; i++) {
            // Check if player still exists on table (Didn't left the game)
            var playerIndex = _ld.findIndex(params.table.players, {playerId: pot.contributors[i]});
            
            if(playerIndex >= 0) {
              if(params.table.players[playerIndex].state === stateOfX.playerState.playing && params.table.players[playerIndex].lastMove !== stateOfX.move.fold) {
                var playerCard = _.where(params.data.cardSets.playerCards, {playerId: pot.contributors[i]})[0];
                params.data.decisionParams[params.data.decisionParams.length-1].playerCards.push(playerCard);
              } else {
                serverLog(stateOfX.serverLogType.info, 'Skipping player ' + params.table.players[playerIndex].playerName + ' state - ' + params.table.players[playerIndex].state + ' and last move - ' + params.table.players[playerIndex].lastMove + ' from contributors');
              }
            } else {
              serverLog(stateOfX.serverLogType.info, 'This player ' + pot.contributors[i] + ' is no more on the table, skipping from contributors!');
            }
          }
          escb();
        }, function (err) {
          if(err) {
            cb({success: false, info: 'Generating params for winner failed!'});
          } else {
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

// ### Decide winner based on Game type

var decidewinner = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function decidewinner');
  isGameProgress(params, function(isGameProgressResponse){
    serverLog(stateOfX.serverLogType.info, 'params.data.decisionParams - ' + JSON.stringify(params.data.decisionParams));
    if(isGameProgressResponse.success) {
      if(!isGameProgressResponse.isSingleWinner) {
        async.eachSeries(params.data.decisionParams, function (decisionSet, ecb) {
        
          // Get winner based on decision params generated previously
          serverLog(stateOfX.serverLogType.info, '------------decisionSet---------------');
          serverLog(stateOfX.serverLogType.info, JSON.stringify(decisionSet));

          serverLog(stateOfX.serverLogType.info, 'Deciding winner for variaton - ' + params.table.channelVariation);
          
          // Decide winner based on Channel/Table variation
          switch(params.table.channelVariation) {
            case stateOfX.channelVariation.holdem     : decisionSet.winners = winnerMgmt.findWinner(decisionSet); break;
            case stateOfX.channelVariation.omaha      : decisionSet.winners = winnerMgmt.findWinnerOmaha(decisionSet); break;
            case stateOfX.channelVariation.omahahilo  : decisionSet.winners = winnerMgmt.findWinnerOmahaHiLo(decisionSet); break;
            default                                   : serverLog(stateOfX.serverLogType.info, 'No case handle for variation - ' + params.table.channelVariation); break;
          }
          
          serverLog(stateOfX.serverLogType.info, '--------- Total Winners from algo ' + decisionSet.winners.length + '---------');
          serverLog(stateOfX.serverLogType.info, JSON.stringify(decisionSet.winners));
          ecb();
        }, function (err) {
          if(err) {
            cb({success: false, channelId: params.channelId, info: 'Deciding winner failed! - ' + err});
          } else {
            params.data.boardCard = params.table.boardCard;
            cb(null, params);
          }
        });
      } else {
        serverLog(stateOfX.serverLogType.info, 'Skipping as this is single player winner case !!');
        cb(null, params);
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Add winning amount for Holdem and Omaha 
// > The cases are same for both variations

var addWinningAmount = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function addWinningAmount');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success) {

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

      async.eachSeries(params.data.decisionParams, function (decisionSet, ecb) { 
        // Get winner based on decision params generated previously
        serverLog(stateOfX.serverLogType.info, '------------addWinningAmount decisionSet---------------');
        serverLog(stateOfX.serverLogType.info, JSON.stringify(decisionSet));
        var winningAmount = decisionSet.amount;

        // Adjust winners array for response to client - Add additional keys
        for (var i = 0; i < decisionSet.winners.length; i++) {
          decisionSet.winners[i].potIndex = decisionSet.potIndex;
          decisionSet.winners[i].amount   = winningAmount / decisionSet.winners.length;
          decisionSet.winners[i].amount   = Math.round(decisionSet.winners[i].amount);
          params.data.winners.push(decisionSet.winners[i]);
        }
        serverLog(stateOfX.serverLogType.info, 'Updated winners after adding winning amount - ' + JSON.stringify(decisionSet.winners));
        ecb();
      }, function (err) {
        if(err) {
          cb({success: false, info: 'Getting winner failed! - ' + err});
        } else {
          params.data.boardCard = params.table.boardCard;
          cb(null, params);
        }
      });
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Add winning amount for Omaha-HiLo 

var addWinningAmountOmahaHiLo = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function addWinningAmountOmahaHiLo');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success) {
      // serverLog(stateOfX.serverLogType.info, )
      if(!isGameProgressResponse.isSingleWinner) {
        if(params.table.channelVariation === stateOfX.channelVariation.omahahilo) {
          async.eachSeries(params.data.decisionParams, function (decisionSet, ecb) {
          
            // Get winner based on decision params generated previously
            serverLog(stateOfX.serverLogType.info, '------------addWinningAmountOmahaHiLo decisionSet---------------');
            serverLog(stateOfX.serverLogType.info, JSON.stringify(decisionSet));
            var winningAmount = decisionSet.amount;

            // Adjust winners array for response to client - Add additional keys
            if(decisionSet.winners.winnerLo.length > 0) {
              serverLog(stateOfX.serverLogType.info, 'There are winners for Lo as well, distribute amount accordingly.');
              for (var i = 0; i < decisionSet.winners.winnerHigh.length; i++) {
                decisionSet.winners.winnerHigh[i].potIndex = decisionSet.potIndex;
                decisionSet.winners.winnerHigh[i].amount   = winningAmount / 2*decisionSet.winners.winnerHigh.length;
                decisionSet.winners.winnerHigh[i].amount   = Math.round(decisionSet.winners.winnerHigh[i].amount);
                params.data.winners.push(decisionSet.winners.winnerHigh[i]);
              }

              for (var j = 0; j < decisionSet.winners.winnerLo.length; j++) {
                decisionSet.winners.winnerLo[j].potIndex = decisionSet.potIndex;
                decisionSet.winners.winnerLo[j].amount   = winningAmount / 2*decisionSet.winners.winnerLo.length;
                decisionSet.winners.winnerLo[j].amount   = Math.round(decisionSet.winners.winnerLo[j].amount);
                params.data.winners.push(decisionSet.winners.winnerLo[j]);
              }
              serverLog(stateOfX.serverLogType.info, 'Updated winners after adding winning amount - ' + JSON.stringify(decisionSet.winners));
            } else {
              serverLog(stateOfX.serverLogType.info, 'There are no winners for LO, all amount for HI win players');
              for (var k = 0; k < decisionSet.winners.winnerHigh.length; k++) {
                decisionSet.winners.winnerHigh[k].potIndex = decisionSet.potIndex;
                decisionSet.winners.winnerHigh[k].amount   = winningAmount / decisionSet.winners.winnerHigh.length;
                decisionSet.winners.winnerHigh[k].amount   = Math.round(decisionSet.winners.winnerHigh[k].amount);
                params.data.winners.push(decisionSet.winners.winnerHigh[k]);
              }
              serverLog(stateOfX.serverLogType.info, 'Updated winners after adding winning amount - ' + JSON.stringify(decisionSet.winners));
            }
            ecb();
          }, function (err) {
            if(err) {
              cb({success: false, channelId: params.channelId, info: 'Getting winner failed! - ' + err});
            } else {
              params.data.boardCard = params.table.boardCard;
              cb(null, params);
            }
          });
        } else {
          serverLog(stateOfX.serverLogType.info, 'Skip winning amount management for variation - ' + params.table.channelVariation);
          cb(null, params);
        }
      } else {
        serverLog(stateOfX.serverLogType.info, 'Skipping for single winner case');
        cb(null, params);
      }
    } else {
      cb(isGameProgressResponse);
    }
  });


};

// ### Assign player cards based on conditions
// > Iterate over playing players
// > Get muck hand value for this player from database
// > Show/Hide player's card if muck hand is disable
// > Forcefully show cards if this is a winner player of table

var assignPlayercards = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function assignPlayercards');
  serverLog(stateOfX.serverLogType.info, 'Winners while assigning cards to display on Game Over - ' + JSON.stringify(params.data.winners));
  async.eachSeries(_.where(params.table.players, {state: stateOfX.playerState.playing}), function(player, ecb) {
    serverLog(stateOfX.serverLogType.info, 'Processing player - ' + player.playerName + ' to show cards on Game Over!');
    serverLog(stateOfX.serverLogType.info, 'Player details on table - ' + JSON.stringify(player));

    db.getUserKeyValue({_id: player.playerId}, "isMuckHand", function(err, isMuckHand) {
      isMuckHand = !!isMuckHand ? isMuckHand : false;

      // Show cards if players hasn't opted muckhand
      var playerIndexOnTable = _ld.findIndex(params.table.players, {playerId: player.playerId});
      if(!isMuckHand) {
        serverLog(stateOfX.serverLogType.info, 'Muck hand is disable for this player, show cards!');
        params.data.cardsToShow[player.playerId] = params.table.players[playerIndexOnTable].cards;
      }

      // If this player is winner then forcefully adding player cards
      async.eachSeries(params.data.winners, function(winner, escb){
        if(winner.playerId === player.playerId) {
          serverLog(stateOfX.serverLogType.info, 'This is a winner player, add cards forcefully!');
          params.data.cardsToShow[player.playerId] = player.cards;
          serverLog(stateOfX.serverLogType.info, 'Updated cardsToShow - ' + JSON.stringify(params.data.cardsToShow));
        }
        escb();
      }, function(err){
        if(!err) {
          serverLog(stateOfX.serverLogType.info, 'Setting winner cards failed!');
        } else {
          serverLog(stateOfX.serverLogType.info, "Winner cards assigned successully!");
        }
        ecb();
      });
    });
  }, function(err) {
    if(err) {
      serverLog(stateOfX.serverLogType.error, 'Assigning player cards after game over failed - ' + JSON.stringify(err));
      cb(err);
    } else {
      serverLog(stateOfX.serverLogType.info, 'Player cards assigned successully !');
      cb(null, params);
    }
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

decideWinner.processWinnerDecision = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In decideWinner function processWinnerDecision');
  async.waterfall([
        
    async.apply(initializeParams,params),
    popRemainingBoardCards,
    storeCardSets,
    generateDecisionParams,
    decidewinner,
    deductRakeOnTable,
    addWinningAmount,
    addWinningAmountOmahaHiLo,
    assignPlayercards

  ],function(err, params){
    if(err) {
      cb(err);
    } else {
      cb({success:true, params: params});
    }
  });
};

module.exports = decideWinner;