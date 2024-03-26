/*jshint node: true */
"use strict";

var async     = require('async'),
    _ld       = require('lodash'),
    _       = require('underscore'),
    stateOfX  = require("../../../../../shared/stateOfX"),
    zmqPublish      = require("../../../../../shared/infoPublisher"),
    keyValidator    = require("../../../../../shared/keysDictionary"),
    handleGameOver = require("../handleGameOver"),
    potsplit = require("../potsplit"),
    db          = require("../../../../../shared/model/dbQuery.js"),
    tableManager = require("../tableManager"),
    responseHandler = require("../responseHandler"),
    roundOver = {};

var roundIsOver = true;

// Create data for log generation
function serverLog (type, log) {
  var logObject = {};
  logObject.fileName      = 'roundOver';
  logObject.serverName    = stateOfX.serverType.database;
  // logObject.functionName  = arguments.callee.caller.name.toString();
  logObject.type          = type;
  logObject.log           = log;
  zmqPublish.sendLogMessage(logObject);
}

roundOver.checkRoundOver = function (params,cb) {
  roundIsOver = true;
  serverLog(stateOfX.serverLogType.info, 'Checking round over, initially set to - ' + roundIsOver);
  async.each(params.table.players, function (player, ecb){
    var index = _ld.findIndex(params.table.players, player);
    if(player.state === stateOfX.playerState.playing) {
      if(player.active) {
        if(!player.isPlayed) {
          serverLog(stateOfX.serverLogType.info, 'Round is not over as a player hasnt made move!');
          roundIsOver = false;
        } else {
          if(params.table.roundMaxBet != params.table.roundBets[index]) {
            if(player.lastMove !== stateOfX.move.allin) {
              serverLog(stateOfX.serverLogType.info, 'Round is not over because of chips balance.');
              roundIsOver = false;
            }
          }
        }
      }
    }
    ecb();
  }, function (err){ 
    serverLog(stateOfX.serverLogType.info, 'Round over updated to - ' + roundIsOver);
    if(err) {
      cb({success: false, info: "End of round check failed!"});
    } else {
    	cb({success: true, roundIsOver: roundIsOver});
    }
	});
};

// ### Validate Game state to be RUNNING throughout performing move calculation

var isGameProgress = function(params, cb) {
  // serverLog(stateOfX.serverLogType.info, 'In roundOver function isGameProgress');
  keyValidator.validateKeySets("Request", "database", "isGameProgress", params, function (validated){
    if(validated.success) {
      if(params.table.state === stateOfX.gameState.running) {
        cb({success: true, isGameOver: false});
      } else {
        handleGameOver.processGameOver(params, function (gameOverResponse){
          serverLog(stateOfX.serverLogType.info, 'Game over response in roundOver - ' + JSON.stringify(gameOverResponse));
          if(gameOverResponse.success) {
            params = gameOverResponse.params;
            params.data.success           = true;
            params.data.roundOver         = true;
            params.data.isGameOver        = true;
            params.data.currentBoardCard  = params.data.remainingBoardCards;
            params.data.winners           = gameOverResponse.winners;
            params.data.rakeDeducted      = gameOverResponse.rakeDeducted;
            params.data.cardsToShow       = gameOverResponse.cardsToShow;
            responseHandler.setActionKeys(params, function(setActionKeysResponse){
              cb(setActionKeysResponse);
            });
          } else {
            cb(gameOverResponse);
          }
        });
      }
    } else {
      cb(validated);
    }
  });
};

// ### Reset table values on round end

var resetTable = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In roundOver function resetTable');
  keyValidator.validateKeySets("Request", "database", "resetTable", params, function (validated){
    if(validated.success) {
      isGameProgress(params, function (isGameProgressResponse){
        if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {

          potsplit.processSplit(params, function (processSplitResponse) {
            serverLog(stateOfX.serverLogType.info, 'roundOver resetTable ==> processSplitResponse - ' + _.keys(processSplitResponse.params));
            if(processSplitResponse.success) {
              params = processSplitResponse.params;
              serverLog(stateOfX.serverLogType.info, 'roundOver resetTable ==> ==== PARAM DATA =====');
              serverLog(stateOfX.serverLogType.info, JSON.stringify(params.data));
              // Set round to next round and game over if last round ends
              params.table.roundName = stateOfX.nextRoundOf[params.table.roundName];
              if(params.table.roundName === stateOfX.round.showdown) {
                serverLog(stateOfX.serverLogType.info, ' roundOver resetTable -  Game is over due to last round ends');
                params.table.state = stateOfX.gameState.gameOver;
              }

              serverLog(stateOfX.serverLogType.info, 'Round name set to - ' + params.table.roundName);
              params.data.roundName = params.table.roundName;

              serverLog(stateOfX.serverLogType.info, '==== PARAM DATA SIDEPOTS =====');
              serverLog(stateOfX.serverLogType.info, JSON.stringify(params.data.sidePots));
              serverLog(stateOfX.serverLogType.info, 'Pre pot - ' + JSON.stringify(params.table.pot));
              if(!!params.data.sidePots && params.data.sidePots.length > 0) {

                // Add if similar pot with same contributor exists
                for (var i = 0; i < params.data.sidePots.length; i++) {
                  for (var j = 0; j < params.table.pot.length; j++) {
                    if(params.table.pot[j].contributors.length === params.data.sidePots[i].contributors.length) {
                      serverLog(stateOfX.serverLogType.info, '---------- Similar pot found -------------');
                      serverLog(stateOfX.serverLogType.info, 'Previous pot amount - ' + params.table.pot[j].amount);
                      serverLog(stateOfX.serverLogType.info, 'Adding in existing pot - ' + JSON.stringify(params.data.sidePots[i]));
                      params.table.pot[j].amount = params.table.pot[j].amount + params.data.sidePots[i].amount;
                      serverLog(stateOfX.serverLogType.info, 'After pot amount - ' + params.table.pot[j].amount);
                      params.data.sidePots[i].processed = true;
                    }
                  }
                }

                // Insert newly created pot due to pot split
                for (var k = 0; k < params.data.sidePots.length; k++) {
                  if(params.data.sidePots[k].processed === false) {
                    serverLog(stateOfX.serverLogType.info, 'Inserting new pot - ' + JSON.stringify(params.data.sidePots[k]));
                    params.table.pot.push(params.data.sidePots[k]);
                  }
                }
              }
              serverLog(stateOfX.serverLogType.info, 'Post pot - ' + JSON.stringify(params.table.pot));

              // Reset round contributors
              params.table.roundContributors = [];

              // Reset round bets values to 0
              params.table.roundBets      = [];
              params.table.roundMaxBet    = 0;
              params.table.minRaiseAmount = params.table.bigBlind;
              params.table.lastBetOnTable = 0;
              params.table.preChecks      = [];
              async.each(params.table.players, function (player, ecb){
                var index = _ld.findIndex(params.table.players, player);
                
                params.table.roundBets[index] = parseInt(0);

                if(player.state === stateOfX.playerState.playing && !player.active) {
                  player.isPlayed = true;
                }
                ecb();
              }, function (err){
                if(err) {
                  cb({success: false, channelId: params.channelId, info: "Reset table on round end failed ! - " + err});
                } else {
                  cb(null, params);
                }
              });
              // cb(null, params);
            } else {
              cb(processSplitResponse);
            }
          });
        } else {
          cb(isGameProgressResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// Update flop players percent when flop rouns starts

var updateFlopPlayers = function (params, cb) {
  serverLog(stateOfX.serverLogType.info, 'About to update flop player percent for this table!');
  if(params.table.roundName === stateOfX.round.flop) {
    serverLog(stateOfX.serverLogType.info, 'This is flop round so updating flop player percent');
    db.findTableById(params.channelId, function(err, result){
      if(err){
        cb({success: false, channelId: params.channelId, info: "Something went wrong!! unable to update"});
      } else{
        serverLog(stateOfX.serverLogType.info, 'Pre percent - ' + result.flopPercent);
        var totalFlopPlayer = result.totalFlopPlayer+params.table.players.length;
        var totalPlayer = result.totalPlayer+params.table.onStartPlayers.length;
        var flopPercent = (totalPlayer/totalFlopPlayer)*100;
        serverLog(stateOfX.serverLogType.info, 'totalFlopPlayer - ' + totalFlopPlayer);
        serverLog(stateOfX.serverLogType.info, 'totalPlayer - ' + totalPlayer);
        serverLog(stateOfX.serverLogType.info, 'flopPercent - ' + flopPercent);
        serverLog(stateOfX.serverLogType.info, 'post percent - ' + result.flopPercent);

        serverLog(stateOfX.serverLogType.info, 'roundOver, Current board card - ' + JSON.stringify(params.data.currentBoardCard));
        db.updateFlopPlayerTable(params.channelId, totalFlopPlayer, totalPlayer, flopPercent, function(err, result){
          if(err){
            cb({success: false, channelId: params.channelId, info: "Something went wrong!! unable to update"});
          } else{
            cb(null, params);
          }
        });
      }
    });
  } else {
    serverLog(stateOfX.serverLogType.info, 'This is not flop round so not updating flop player percent');
    cb(null, params);
  }
};


// ### Reset player values on round end

var resetPlayer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In roundOver function resetPlayer');
  keyValidator.validateKeySets("Request", "database", "resetPlayer", params, function (validated){
    if(validated.success) {
      isGameProgress(params, function (isGameProgressResponse){
        if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
          async.each(params.table.players, function (player, ecb){
            player.isPlayed       = false;
            player.totalRoundBet  = 0;
            ecb();
          }, function (err){
            if(err) {
              cb({success: false, info: "Reseting player on round over failed"});
            } else {
              cb(null, params);
            }
          });
        } else {
          cb(isGameProgressResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### pop some card from deck on table

var popCardFromDeck = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In roundOver function popCardFromDeck');
  keyValidator.validateKeySets("Request", "database", "popCardFromDeck", params, function (validated){
    if(validated.success) {
      var cards = params.table.deck.slice(0, params.count);
      params.table.deck.splice(0, params.count);
      cb({success: true, cards: cards});
    } else {
      cb(validated);
    }
  });
};

// ### Burn cards on table
// > Consider run it twice case where another similar no of 
// > burn cards open at same time

var burnCards = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In roundOver function burnCards');
  keyValidator.validateKeySets("Request", "database", "burnCards", params, function (validated){
    if(validated.success) {
      isGameProgress(params, function (isGameProgressResponse){
        if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
          var cardsToPop = params.table.roundName === stateOfX.round.flop ? 3 : 1;

          // Pop card on board based on current round
          popCardFromDeck({serverType: "database", table: params.table, count: cardsToPop}, function (popCardFromDeckResponse){
            if(popCardFromDeckResponse.success) {
              for (var i = 0; i < popCardFromDeckResponse.cards.length; i++) {
                params.table.boardCard[0].push(popCardFromDeckResponse.cards[i]);
              }
              cb(null, params);
            } else {
              cb({success: false, channelId: params.channelId, info: 'ERROR: poping card for round - ' + params.table.roundName});
            }
          });

          // Pop extra cards on boards if run-it-twice condition occured
          tableManager.isRunItTwice(params, function(isRunItTwiceResponse){ 
            if(isRunItTwiceResponse) {
              serverLog(stateOfX.serverLogType.info, 'Run it twice enabled on round over check!');
              popCardFromDeck({serverType: "database", table: params.table, count: cardsToPop}, function (popCardFromDeckResponse){
                if(popCardFromDeckResponse.success) {
                  for (var i = 0; i < popCardFromDeckResponse.cards.length; i++) {
                    if(params.table.roundName === stateOfX.round.flop) {
                      params.table.boardCard[1].push(null);
                    } else {
                      params.table.boardCard[1].push(popCardFromDeckResponse.cards[i]);
                    }
                  }
                  cb(null, params);
                } else {
                  cb({success: false, channelId: params.channelId, info: 'ERROR: poping card for round - ' + params.table.roundName});
                }
              });
            } else {
              serverLog(stateOfX.serverLogType.info, 'Run it twice not enabled yet on round over check!');
              for (var i = 0; i < cardsToPop; i++) {
                params.table.boardCard[1].push(null);
              }
              cb(null, params);
            }
          });
        } else {
          cb(isGameProgressResponse);
        }
      });
    } else {
      cb(validated);
    }
  });
};

// ### Set current board card for broadcast

var setCurrentBoardCard = function (params, cb) {
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      serverLog(stateOfX.serverLogType.info, 'roundOver, Current round name - ' + params.table.roundName);
      switch(params.table.roundName) {
        case stateOfX.round.preflop   : params.data.currentBoardCard = [[], []]; break;
        case stateOfX.round.flop      : params.data.currentBoardCard = params.table.boardCard; break;
        case stateOfX.round.turn      : params.data.currentBoardCard = [[params.table.boardCard[0][3]], [params.table.boardCard[1][3]]]; break;
        case stateOfX.round.river     : params.data.currentBoardCard = [[params.table.boardCard[0][4]], [params.table.boardCard[1][4]]]; break;
        case stateOfX.round.showdown  : serverLog(stateOfX.serverLogType.info, 'In ' + params.table.roundName + ' no new card will open!') ; break;
        default                       : serverLog(stateOfX.serverLogType.info, 'No handler for this round name - ' + params.table.roundName); break;
      }
      serverLog(stateOfX.serverLogType.info, 'roundOver, Current board card - ' + JSON.stringify(params.data.currentBoardCard));
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

roundOver.processRoundOver = function (params,cb){
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      roundOver.checkRoundOver(params, function(roundOverResponse){
        // serverLog(stateOfX.serverLogType.info, 'roundOverResponse - ' + JSON.stringify(roundOverResponse));
        if(roundOverResponse.success) {
          params.data.roundOver = roundOverResponse.roundIsOver;
          if(params.data.roundOver) {
            serverLog(stateOfX.serverLogType.info, 'Round is over, about to process - reset table, player and open board cards!');
            async.waterfall([
              
              async.apply(resetTable, params),
              updateFlopPlayers,
              resetPlayer,
              burnCards,
              setCurrentBoardCard

            ], function (err, response){
              serverLog(stateOfX.serverLogType.info, 'err, response in roundOver');
              serverLog(stateOfX.serverLogType.error, JSON.stringify(err));
              serverLog(stateOfX.serverLogType.info, JSON.stringify(response));
              
              if(err) {
                if(!!err.data && err.data.success) {
                  cb(err);
                } else {
                  serverLog(stateOfX.serverLogType.info, stateOfX.serverLogType.error, 'This should not be success response - ' + JSON.stringify(err));
                  cb(err);
                }
              } else {
                cb({success: true, params: response});
              }
            });
          } else {
            serverLog(stateOfX.serverLogType.info, 'Round is not over, validated in normal make move for resetting table.');
            cb({success: true, params: params});
          }
        } else {
          cb(roundOverResponse);
        }
      });
    } else {
      cb(isGameProgressResponse);
    }
  });
};

module.exports = roundOver;