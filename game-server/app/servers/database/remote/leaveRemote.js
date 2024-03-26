/*jshint node: true */
"use strict";

/**
 * Created by Amrendra on 04/07/2016.
**/
var async                  = require("async"),
    _ld                    = require("lodash"),
    _                      = require('underscore'),
    roundOver              = require('./utils/roundOver'),
    summary                = require('./utils/summaryGenerator'),
    stateOfX               = require("../../../../shared/stateOfX"),
    activity               = require("../../../../shared/activity"),
    keyValidator           = require("../../../../shared/keysDictionary"),
    imdb                   = require("../../../../shared/model/inMemoryDbQuery.js"),
    popupTextManager       = require("../../../../shared/popupTextManager").falseMessages,
    popupTextManagerFromdb = require("../../../../shared/popupTextManager").dbQyeryInfo,
    db                     = require("../../../../shared/model/dbQuery.js"),
    adminDb                = require("../../../../shared/model/adminDbQuery.js"),
    mongodb                = require('../../../../shared/mongodbConnection'),
    profileMgmt            = require("../../../../shared/model/profileMgmt"),
    zmqPublish             = require("../../../../shared/infoPublisher"),
    setMove                = require('./setMove'),
    potsplit               = require('./potsplit'),
    adjustIndex            = require('./adjustActiveIndex'),
    handleGameOver         = require('./handleGameOver'),
    tableManager           = require("./tableManager"),
    responseHandler        = require("./responseHandler"),
    tournamentLeave        = require("./tournamentLeave")


var leaveRemote = {};

// Create data for log generation
function serverLog (type, log) {
  var logObject          = {};
  logObject.fileName     = 'leaveRemote';
  logObject.serverName   = stateOfX.serverType.database;
  // logObject.functionName = arguments.callee.caller.name.toString();
  logObject.type         = type;
  logObject.log          = log;
  zmqPublish.sendLogMessage(logObject);
}

function fixedDecimal(number, precisionValue) {
  let precision = precisionValue ? precisionValue : 2;
  return Number(Number(number).toFixed(precision));
}

// Validate if Game is running throughout calculation of player leave
// If Game is over then process game over and then
// Create response for Game over as well and return to relevant function
var isGameProgress = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function isGameProgress');
  keyValidator.validateKeySets("Request", params.serverType, "isGameProgress", params, function(validated){
    if(validated.success) {
      if(params.table.state === stateOfX.gameState.running) {
        cb({success: true, isGameOver: false});
      } else {
        handleGameOver.processGameOver(params, function(gameOverResponse){
          serverLog(stateOfX.serverLogType.info, 'Game over response in leaveRemote - ' + JSON.stringify(gameOverResponse));
          if(gameOverResponse.success) {
            params = gameOverResponse.params;
            serverLog(stateOfX.serverLogType.info,'isCurrentPlayer while respone after GAME OVER - ' + params.data.isCurrentPlayer);
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

// ### Add additional params for calculation
var initializeParams = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function initializeParams');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      params.data                   = _.omit(params.data, '__route__');
      params.data.action            = params.data.isStandup ? stateOfX.move.standup : stateOfX.move.leave;
      params.data.index             = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
      params.data.state             = null;
      if(params.data.index >= 0) {
        // If player has taken a seat on table
        params.data.state           = params.table.players[params.data.index].state;
        // params.data.preState        = // todo
        serverLog(stateOfX.serverLogType.info, 'Player details who is going to leave - ' + JSON.stringify(params.table.players[params.data.index]));
      }
      params.data.isCurrentPlayer   = false;
      params.data.roundOver         = false;
      params.data.isGameOver        = (params.table.state === stateOfX.gameState.gameOver);
      params.data.chips             = 0;
      params.data.amount            = 0;
      params.data.pot               = _.pluck(params.table.pot, 'amount');
      params.data.currentBoardCard  = [[], []];
      params.data.isSeatsAvailable  = false;
      serverLog(stateOfX.serverLogType.info,'Player ' + params.data.playerName + ' at index - ' + params.data.index + ' has state - ' + params.data.state + ' is going to ' + params.data.action + ' while game is running.');
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// Validate if this standup or leave is allowed for this player
// check cases as listed (with exported function)
var checkOrigin = function (params, cb) {
  console.error('.......,,,,,,,', params.data.origin);
  if (params.data.origin) {
    if(params.data.origin == 'kickToLobby'){
      if (params.data.index < 0) {
        cb(null, params);
      } else {
        cb({success: false, channelId: params.channelId, info: 'Kick to lobby is only allowed for observer.'});
      }
    } else if (params.data.origin == 'vacantSeat') {
      if (params.data.index >= 0 && params.table.players[params.data.index].state == stateOfX.playerState.reserved) {
        cb(null, params);
      } else {
        if (params.data.index < 0) {
          cb(null, params);
        } else {
          cb({success: false, channelId: params.channelId, info: 'Vacant reserved seat is only allowed for observer/ RESERVED sitting.'});
        }
      }
    } else if (params.data.origin == 'tableIdleTimer'){
      if (params.table.state == stateOfX.gameState.idle) {
        cb(null, params);
      } else {
        cb({success: false, channelId: params.channelId, info: 'Leave on idle table is only allowed when idle table.'});
      }
    } else if (params.data.origin == 'idlePlayer') {
      if (params.data.index >= 0 && params.table.players[params.data.index].state == stateOfX.playerState.onBreak) {
        cb(null, params);
      } else {
        if (params.data.index < 0) {
          cb(null, params);
        } else {
          cb({success: false, channelId: params.channelId, info: 'Idle player removal is only allowed for observer/ ONBREAK sitting.'});
        }
      }
    } else {
      cb(null, params);
    }
  } else {
    cb(null, params);
  }
};

// > Spectator player cannot opt to standup
var validateAction = function (params, cb) {
  if(params.data.index < 0 && params.data.action === stateOfX.move.standup) {
    cb({success: false, channelId: params.channelId, info: "You are not allowed to " + params.data.action + ", please choose Leave.", isRetry: false, isDisplay: false});
  } else {
    checkOrigin(params, cb);
    // cb(null, params);
  }
};

// player can not leave if he has round bet
var isLeavePossible = function (params, cb) {
  if (params.data.index >=0) {
    if (params.table.players[params.data.index].lastMove == stateOfX.move.fold || params.table.players[params.data.index].state == stateOfX.playerState.waiting) {
      cb(null, params);
    } else {
      cb({success: false, channelId: params.data.channelId, info: "You Cannot Leave as you have bet in round.", isRetry: false, isDisplay: true});
    }
  } else {
    cb(null, params);
  }
};

// set player state as ONLEAVE
var updatePlayer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function updatePlayer');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(params.data.index >= 0) {
        // console.log('in leaveRemote function updatePlayer',params.table);
        // summary.playerLeave(params,params.table.players[params.data.index].seatIndex,function(summary){
        //   console.log("summary",summary);
        // })
        params.table.players[params.data.index].state = stateOfX.playerState.onleave;
        params.table.players[params.data.index].active = false;

      }
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// set isCurrentPlayer true if player who had turn, try to leave
var isCurrentPlayer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function isCurrentPlayer');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(params.data.index >= 0) {
        serverLog(stateOfX.serverLogType.info,'Resetting isCurrentPlayer');
        params.data.isCurrentPlayer = params.data.index === params.table.currentMoveIndex;
        serverLog(stateOfX.serverLogType.info,'Updated isCurrentPlayer - ' + params.data.isCurrentPlayer);
      }
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// Update current player and first active player indexes
var updateConfigIndexes = function (params, cb) {
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      // Update currentMoveIndex if required
      // In case of player leave in between from array
      serverLog(stateOfX.serverLogType.info,'-------- Updating config indexes -------');
      // Do not add PLAYING state condition as any player on the table leave will
      // update the indexes of config players
      if(params.data.index >= 0) {
        serverLog(stateOfX.serverLogType.info,'Player has taken a seat on table');
        // serverLog(stateOfX.serverLogType.info,'table while removing player - ' + JSON.stringify(_.omit(params.table, 'deck')))
        serverLog(stateOfX.serverLogType.info,'players while leave - ' + JSON.stringify(params.table.players));
        serverLog(stateOfX.serverLogType.info,'currentMoveIndex - ' + params.table.currentMoveIndex);
        serverLog(stateOfX.serverLogType.info,'firstActiveIndex - ' +  params.table.firstActiveIndex);
        serverLog(stateOfX.serverLogType.info,'Index of player to leave - ' + params.data.index);
        // serverLog(stateOfX.serverLogType.info,'Active players - ' + JSON.stringify(activePlayers));
        // If player left before config index then reduce config indexes
        if(params.data.index < params.table.currentMoveIndex) {
          serverLog(stateOfX.serverLogType.info,'Player left before config indexes SETTING current player');
          if(params.table.currentMoveIndex - 1 >= 0) {
            params.table.currentMoveIndex = params.table.currentMoveIndex - 1;
          }
          serverLog(stateOfX.serverLogType.info,'New currentMoveIndex should be - ' + params.table.currentMoveIndex);
        }
        // If player left before config index then reduce config indexes
        if(params.data.index < params.table.firstActiveIndex) {
          serverLog(stateOfX.serverLogType.info,'Player left before config indexes SETTING first active player index');
          if(params.table.firstActiveIndex - 1 >= 0) {
            params.table.firstActiveIndex = params.table.firstActiveIndex - 1;
          }
          serverLog(stateOfX.serverLogType.info,'New firstActiveIndex should be - ' + params.table.firstActiveIndex);
        }
      } else {
        serverLog(stateOfX.serverLogType.info,'Player hasnt taken a seat or not PLAYING in the table while ' + params.data.action + ' !');
      }
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// check for game over by
// is there any player with move?
var validateGameOver = function (params, cb) {
  // Check if Game should over after this leave
  // Game will over if there is only one active player left or
  // ALLIN player also consider as inactive then we need to check all players made their move
  // We are not considering here if the player with move left or any other player left
  // As Game can over either conditions
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      serverLog(stateOfX.serverLogType.info,'-------- Validating Game Over -------');
      serverLog(stateOfX.serverLogType.info,'Player who has move left? - ' + params.data.isCurrentPlayer);
      if(params.data.index >= 0 ) {
        if(params.data.state !== stateOfX.playerState.waiting && params.data.state !== stateOfX.playerState.outOfMoney && params.data.state !== stateOfX.playerState.onBreak) {
          if(tableManager.isPlayerWithMove(params) === false) {
            serverLog(stateOfX.serverLogType.info,'There are no players with move left into the game, Game Over!');
            params.table.state = stateOfX.gameState.gameOver;
          } else {
            serverLog(stateOfX.serverLogType.info,'There are players with move left in the game.');
          }
        } else {
          serverLog(stateOfX.serverLogType.info,'NOT CHECKING Game Over as playing with - ' + params.table.players[params.data.index].state + ' left the game!');
        }

      } else {
        serverLog(stateOfX.serverLogType.info,'NOT CHECKING Game Over as player not taken a seat left the game!');
      }
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// remove activity saved for user in disconnectin handling.
// use of this - deprecated
var removeActivity = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function removeActivity');
  serverLog(stateOfX.serverLogType.info,'Action while removing record activity: ' +  params.data.action);
  if((params.data.action !== stateOfX.move.standup) || (!params.data.isRequested)) {
    imdb.removeActivity({channelId: params.channelId, playerId: params.data.playerId}, function(err, response){
      if(!err && !!response) {
        serverLog(stateOfX.serverLogType.info, 'succefully remove activity from in memory for leave in disconnectin handling');
        cb(null, params);
      } else {
        cb({success: false, isRetry: false, isDisplay: false,channelId: (params.channelId || ""), tableId: params.tableId, info: popupTextManagerFromdb.IMDBREMOTEACTIVITY_REMOTEACTIVITY_LEAVEREMOTE});
        //cb({success: false, isDisplay: false, isRetry: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to remove player activity from in memory'});
      }
    });
  } else {
    cb(null, params);
  }
};

// Remove spectator record associated to this player and this table
var removeSpectatorRecord = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function removeSpectatorRecord');
  if((params.data.action !== stateOfX.move.standup)) {
  //console.error(stateOfX.serverLogType.info, 'in leaveRemote function removeSpectatorRecord',params);
    imdb.removePlayerAsSpectator({channelId: params.channelId, playerId: params.data.playerId}, function(err, response){
      if(err) {
        cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), info: popupTextManagerFromdb.DB_REMOVETABLESPECTATOR_FAIL});
      } else {
        cb(null, params);
      }
    });
  }else{
    cb(null, params);
  }
};

// generate summary text on leave and add to params.table.summaryOfAllPlayers
var onLeaveSummary = function(params,cb){
  if(params.data.state == stateOfX.playerState.playing){
    summary.onLeave(params);
    activity.leaveGame(params,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.leave,stateOfX.logType.success);
    activity.leaveGame(params,stateOfX.profile.category.game,stateOfX.game.subCategory.leave,stateOfX.logType.success);
  }
  cb(null,params);
};

// Remove player object from player array on table
var removeFromTable = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function removeFromTable',params);
    if(params.data.index >= 0) {
      var removedPlayers = params.table.players.splice(params.data.index, 1); // splice returns removed elements array
      if(removedPlayers.length > 0){
        params.table.removedPlayers = params.table.removedPlayers || [];
        // adding removed players ONLY if not there already
        var len = params.table.removedPlayers.length;
        for (var i = 0; i < removedPlayers.length; i++) {
          var already = false;
          for (var j = 0; j < len; j++) {
            if(removedPlayers[i].playerId === params.table.removedPlayers[j].playerId){
              already = true;
              break;
            }
          }
          if (!already) {
            params.table.removedPlayers.push(removedPlayers[i]);
          }
        }
      }
    }
  if(params.data.isStandup){
     //   params.table.players.splice(params.data.index, 1);
    imdb.upsertPlayerJoin({channelId: params.channelId, playerId: params.data.playerId}, {$setOnInsert: {playerName: params.playerName, channelType:params.channelType, firstJoined: Number(new Date())}, $set: {/*networkIp: params.networkIp,*/ observerSince: Number(new Date()), event: 'standup'}}, function(err, response){
      if(!err && response) {
        cb(null, params);
      } else {
        cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), tableId: params.tableId,info: popupTextManagerFromdb.IMDBREMOVEPLAYERJOIN_REMOVEFROMTABLE_LEAVEREMOTE});
        //cb({success: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to remove player record in join - ' + JSON.stringify(err)});
      }
    });
        // cb(null, params);
  }else{
    imdb.removePlayerJoin({channelId: params.channelId, playerId: params.data.playerId}, function(err, response){
      if(!err && response) {
        cb(null, params);
      } else {
        cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), tableId: params.tableId,info: popupTextManagerFromdb.IMDBREMOVEPLAYERJOIN_REMOVEFROMTABLE_LEAVEREMOTE});
        //cb({success: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to remove player record in join - ' + JSON.stringify(err)});
      }
    });
  }
  // if(params.data.index >= 0) {
  //   serverLog(stateOfX.serverLogType.info,'Removing player from table');
  //   imdb.removePlayerJoin({channelId: params.channelId, playerId: params.data.playerId}, function(err, response){
  //     if(!err && response) {
  //       cb(null, params);
  //     } else {
  //       cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), tableId: params.tableId,info: popupTextManagerFromdb.IMDBREMOVEPLAYERJOIN_REMOVEFROMTABLE_LEAVEREMOTE});
  //       //cb({success: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to remove player record in join - ' + JSON.stringify(err)});
  //     }
  //   });
  // } else {
  //   serverLog(stateOfX.serverLogType.info, 'Player hasnt taken seat, so removing from db records only, Running Game.');
  //   imdb.removePlayerJoin({channelId: params.channelId, playerId: params.data.playerId}, function(err, response){
  //     if(!err && response) {
  //       cb(null, params);
  //     } else {
  //       cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), tableId: params.tableId,info: popupTextManagerFromdb.IMDBREMOVEPLAYERJOIN_REMOVEFROMTABLE_LEAVEREMOTE});
  //       //cb({success: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to remove player record in join - ' + JSON.stringify(err)});
  //     }
  //   });
  // }
};

// check if current betting round is over due to this player leave action
var isRoundOver = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function isRoundOver');
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      roundOver.processRoundOver(params, function(processRoundOverResponse){
        if(processRoundOverResponse.success && !processRoundOverResponse.isGameOver) {
          cb(null, processRoundOverResponse.params);
        } else {
          cb(processRoundOverResponse);
        }
      });
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Update first player index if
// > First active player left the game
// or update current move player
var setfirstActiveIndex = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function setfirstActiveIndex');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {

      if(params.data.index === params.table.firstActiveIndex) {
        serverLog(stateOfX.serverLogType.info,'This is the first active player to dealer left the table.');
        params.table.firstActiveIndex = params.table.players[params.data.index].nextActiveIndex;
      }
      if(params.data.isCurrentPlayer) {
        serverLog(stateOfX.serverLogType.info,'This is the current player to leave.');
        serverLog(stateOfX.serverLogType.info,'Current player index- ' + params.table.currentMoveIndex);
        params.table.currentMoveIndex = params.table.players[params.table.currentMoveIndex].nextActiveIndex;
        serverLog(stateOfX.serverLogType.info,'Next player move set to next active index - ' + params.table.currentMoveIndex);
      }
      cb(null, params);

    } else {
      cb(isGameProgressResponse);
    }
  });
};

// adjust next move 
// if round over and/or current player has left
var setNextPlayer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function setNextPlayer');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(params.data.state === stateOfX.playerState.playing) {
        if(params.data.isCurrentPlayer) {
          if(params.data.roundOver) {
            serverLog(stateOfX.serverLogType.info,'Round is over after this leave, setting first player index as next player with turn.');
            params.table.currentMoveIndex = params.table.firstActiveIndex;
            serverLog(stateOfX.serverLogType.info,'Next player move set to first active index - ' + params.table.currentMoveIndex);
            cb(null, params);
          } else {
            serverLog(stateOfX.serverLogType.info,'Round doesnt over after this leave, setting next active index as next player with turn.');
            // params.table.currentMoveIndex = params.table.players[params.table.currentMoveIndex].nextActiveIndex;
            serverLog(stateOfX.serverLogType.info,'Next player move will not resetting here, might be already set in previous functions');
            cb(null, params);
          }
        } else {
          serverLog(stateOfX.serverLogType.info, 'Player was not the player with turn, so skipping turn transfer.');
          cb(null, params);
        }
      } else {
        serverLog(stateOfX.serverLogType.info, 'Player was not in PLAYING state, so skipping turn transfer.');
        cb(null, params);
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Set maximum raise for next player
var setMaxRaise = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'In leaveRemote function setMaxRaise');
  // if(params.table.currentMoveIndex === -1) {
  //   cb({success: false, isRetry: false, isDisplay: true, channelId: (params.channelId || ""), tableId: params.tableId,info: popupTextManager.NOCURRENTPLAYERONMAXRAISE});
  //   return false;
  // }
  isGameProgress(params, function (isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      params.table.maxRaiseAmount = tableManager.maxRaise(params.table);
      serverLog(stateOfX.serverLogType.info, 'leaveRemote Updated max raise - ' + params.table.maxRaiseAmount);
      cb(null, params);
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Adjust round bets if a playing player left the game
var adjustRoundBets = function (params, cb) {
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      //console.error("^^^^^^^^^^^^^^&&&&&&&&&&&&&&############",params.data);
      var playerOnTable = -1;
      if(params.data.index >= 0){
        playerOnTable = params.table.onStartPlayers.indexOf(params.data.playerId);
      }
      if(params.data.index >= 0 && playerOnTable >= 0) {
        serverLog(stateOfX.serverLogType.info,'A playing player left the game from index ' + params.data.index + ' - adjust round bets.');
        serverLog(stateOfX.serverLogType.info,'Roundbets in round so far - ' + params.table.roundBets);
        // Case: When last player with move left the game and roundOver check already cleared
        // the index from table.roundBets and check will prevent to add additional roundBets with
        // null or undefined which make totalPot value NULL in view as well
        if(params.table.roundBets[params.data.index] != undefined && params.table.roundBets[params.data.index] >= 0) {
          var playerAmountInRound = !!params.table.roundBets[params.data.index] ? params.table.roundBets[params.data.index] : 0;
          serverLog(stateOfX.serverLogType.info,'Amount added by player in current round - ' + playerAmountInRound);
          params.table.roundBets.splice(params.data.index, 1);
          serverLog(stateOfX.serverLogType.info,'Player bet removed from roundBets - ' + params.table.roundBets);
          params.table.roundBets.push(playerAmountInRound);
          serverLog(stateOfX.serverLogType.info,'Updated roundBets after placing roundbets at the end of array - ' + params.table.roundBets);
        } else {
          serverLog(stateOfX.serverLogType.info, 'No need to adjust round bets in this case, might be already adjusted in round over condition.');
        }
        cb(null, params);
      } else {
        cb(null, params);
      }
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Decide players prechecks
var decidePlayerPrechecks = function (params, cb) {
  setMove.assignPrechecks(params, function(assignPrechecksResponse) {
    if(assignPrechecksResponse.success) {
      params = assignPrechecksResponse.params;
      cb(null, params);
    } else {
      cb(assignPrechecksResponse);
    }
  });
};

// get moves of NEW current move player
var getMoves = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function getMoves');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      if(params.data.isCurrentPlayer) {
        setMove.getMove(params, function(getMoveResponse){
          if(getMoveResponse.success) {
            cb(null, getMoveResponse.params);
          } else {
            cb(getMoveResponse);
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

// Perform move handler
// create leave response
// also add keys according to TURN if current player left
// also for roundOver and/or
// for gameOver
var createLeaveResponse = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function createLeaveResponse');
  isGameProgress(params, function(isGameProgressResponse){
    if(isGameProgressResponse.success && !isGameProgressResponse.isGameOver) {
      serverLog(stateOfX.serverLogType.info,'creating response for Game over on leave ' + JSON.stringify(_.omit(params.table, 'deck')));
      // Set current time for player turn starts at
      if(params.data.isCurrentPlayer) {
        params.table.turnTimeStartAt = Number(new Date());
      }
      params.data.success           = true;
      params.data.isGameOver        = false;
      params.data.winners           = isGameProgressResponse.winners;
      params.data.rakeDeducted      = isGameProgressResponse.rakeDeducted;
      params.data.cardsToShow       = isGameProgressResponse.cardsToShow;

      responseHandler.setActionKeys(params, function(setActionKeysResponse){
        cb(null, setActionKeysResponse);
      });
    } else {
      cb(isGameProgressResponse);
    }
  });
};

// ### Adjust active player indexes among each other
// > Set preActiveIndex and nextActiveIndex values for each player
// > Used for turn transfer importantly
var adjustActiveIndexes = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function adjustActiveIndexes');
  adjustIndex.perform(params, function(performResponse) {
    cb(null, performResponse.params);
  });
};

// Set params when game is not running
var setLeaveParams = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function setLeaveParams');
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function setLeaveParams - ' + JSON.stringify(params.table.players));
  params.data        = _.omit(params.data, '__route__');
  params.data.action = params.data.isStandup ? stateOfX.move.standup.toUpperCase() : stateOfX.move.leave.toUpperCase();
  params.data.index  = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
  serverLog(stateOfX.serverLogType.info,'Player at index - ' + params.data.index + ' is going to ' + params.data.action + ' !');
  cb(null, params);
};

// Refund amount to player after leave
// refund only player.chips
var refundAmountOnLeave = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function refundAmountOnLeave');
  serverLog(stateOfX.serverLogType.info, 'About to refund player at index - ' + params.data.index);
  if(params.data.index >= 0){
    serverLog(stateOfX.serverLogType.info, 'Player have taken a seat on table.');
    var chipsToRefund = fixedDecimal(params.table.players[params.data.index].chips, 2);
    var instantBonusAmount = fixedDecimal(params.table.players[params.data.index].instantBonusAmount, 2);
    if(chipsToRefund > 0) {
      profileMgmt.addChips({playerId: params.data.playerId, chips: chipsToRefund, isRealMoney: params.table.isRealMoney, instantBonusAmount: instantBonusAmount, category : "Table Actions", tableName: params.table.channelName},function(addChipsResponse){
        serverLog(stateOfX.serverLogType.info, 'Add chips response from db - ' + JSON.stringify(addChipsResponse));
        if(addChipsResponse.success){
          cb(null, params);
        } else{
          //cb({success: false, channelId: params.channelId, info: "Refund money to player account failed on - " + params.data.action});
          cb({success: false, channelId: (params.channelId || ""), info: popupTextManager.PROFILEMGMTADDCHIPS_REFUNDAMOUNTONLEAVE_LEAVEREMOTE + params.data.action, isRetry : false, isDisplay : true});
        }
      });
    } else {
      createPassbookEntry({playerId: params.data.playerId, tableName: params.table.channelName});
      serverLog(stateOfX.serverLogType.info, 'Skipping refund as, Player has total chips on table  -  '  + chipsToRefund + ' .');
      cb(null, params);
    }
  } else{
    serverLog(stateOfX.serverLogType.info, 'Skipping refund as, Player hasnt taken the seat on table.');
    cb(null, params);
  }
};

var createPassbookEntry = function(data){
  var query = {playerId: data.playerId};
  db.findUser(query, function(err, result){
    var passbookData = {
      time: Number(new Date()),
      prevAmt : result.realChips + result.instantBonusAmount,
      category: "Table Actions",
      amount : 0,
      newAmt : result.realChips + result.instantBonusAmount,
      subCategory: "Leave",
      tableName: data.tableName
    };
    adminDb.createPassbookEntry(query, passbookData, function(err, passResult){
      console.log("Passbook entry error is "+ err);
      console.log("Passbook entry result is "+ passResult);
    });
  });
};

// Remove anti banking entry
var removeAntiBanking = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function removeAntiBanking');
  db.removeAntiBankingEntry({playerId: params.data.playerId, channelId: params.channelId}, function(err, res){
    if(!err && res) {
      cb(null, params);
    } else {
      serverLog(stateOfX.serverLogType.error, 'Unable to insert anti banking details in database: ' + JSON.stringify(err));
      cb({success: false, channelId: (params.channelId || ""), info: popupTextManagerFromdb.DB_REMOVEANTIBANKING_FAIL, isRetry : false, isDisplay : false});
    }
  });
};

// Create anti banking entry
var insertAntiBanking = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function insertAntiBanking');
  var antiBankingTime = Number(new Date());
  console.error(new Date());
  //antiBankingTime = new Date(antiBankingTime);
  console.error(antiBankingTime);
  db.insertAntiBanking({playerId: params.data.playerId, channelId: params.channelId, createdAt: new Date(), expireAt: antiBankingTime, amount: params.table.players[params.data.index].chips}, function(err, res){
    if(!err && res) {
      serverLog(stateOfX.serverLogType.info, 'Anti banking details for this leave has been added successfully.');
      cb(null, params);
    } else {
      serverLog(stateOfX.serverLogType.error, 'Unable to remove anti banking details from database: ' + JSON.stringify(err));
      cb({success: false, channelId: (params.channelId || ""), info: popupTextManagerFromdb.DB_INSERTANTIBANKING_FAIL, isRetry : false, isDisplay : false});
    }
  });
};

// Create antibanking entry for this player on leave
// if player left with more money than minBUyIn after playing atleast a game
var createAntiBankingEntry = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function createAntiBankingEntry');
  // Make sure player has occupied seat
// console.error(params.table.players[params.data.index].chips ,"@@@@@@@@@@@@@@@@@@@@@@@@@@@@", params.table.players[params.data.index].onSitBuyIn ,"create antibanking");
  if(params.data.index < 0){
    serverLog(stateOfX.serverLogType.info, 'Skipping antibanking entry as, Player hasnt taken the seat on table.');
    cb(null, params);
    return true;
  }

  // Make sure player has played once on this table
  if(!params.table.players[params.data.index].hasPlayedOnceOnTable && params.table.players[params.data.index].onSitBuyIn >= params.table.players[params.data.index].chips) {
    serverLog(stateOfX.serverLogType.info, 'Skipping antibanking entry as, player hasnt played any game on table.');
    cb(null, params);
    return true;
  }

  // Do not perform anything if RESERVED/WAITING player left the game
  // if(params.table.players[params.data.index].state === stateOfX.playerState.reserved) {
  //   serverLog(stateOfX.serverLogType.info, 'Skipping antibanking entry as, Player is in state ' + params.table.players[params.data.index].state + ', removing if already exists.');
  //   // removeAntiBanking(params, function(err, res){
  //   //   cb(err, res);
  //   // });
  //   cb(null, params);
  //   return true;
  // }
  // Make sure player has chips and i greater than minbuyin at least
  if(params.table.players[params.data.index].chips <= params.table.minBuyIn) {
    console.error(params,"do not craete anti banking",params.table.players[params.data.index].chips);
    serverLog(stateOfX.serverLogType.info, 'Removing anti banking entry, as player has total chips on table  -  '  + params.table.players[params.data.index].chips + ' .');
    removeAntiBanking(params, function(err, res){
      cb(err, res);
    });
  } else { // Player is leaving more chips than min buyin, remove previous entry and create new one
     console.error(params,"do craete anti banking",params.table.players[params.data.index].chips);
    removeAntiBanking(params, function(err, res){
      insertAntiBanking(params, function(err, res){
        cb(err, res);
      });
    });
  }
};

// deprecated - never in future too
// var removePlayer = function(params, cb) {
//   serverLog(stateOfX.serverLogType.info, 'in leaveRemote function removePlayer');
//   if(params.data.index >= 0) {
//     serverLog(stateOfX.serverLogType.info,'Removing player from table')
//     imdb.removePlayerJoin({channelId: params.channelId, playerId: params.data.playerId}, function(err, response){
//       if(!err && response) {
//         params.table.players.splice(params.data.index, 1);
//         cb(null, params);
//       } else {
//         cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), tableId: params.tableId,info: popupTextManagerFromdb.IMDBREMOVEPLAYERJOIN_REMOVEPLAYER_LEAVEREMOTE + JSON.stringify(err)});
//         //cb({success: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to store player record in join - ' + JSON.stringify(err)});
//       }
//     });
//   } else {
//     serverLog(stateOfX.serverLogType.info, 'Player hasnt taken seat, so removing from db records only, Not running Game.');
//     imdb.removePlayerJoin({channelId: params.channelId, playerId: params.data.playerId}, function(err, response){
//       if(!err && response) {
//         cb(null, params);
//       } else {
//         cb({success: false, isRetry: false, isDisplay: false, channelId: (params.channelId || ""), tableId: params.tableId,info: popupTextManagerFromdb.IMDBREMOVEPLAYERJOIN_REMOVEPLAYER_LEAVEREMOTE + JSON.stringify(err)});
//         //cb({success: false, channelId: params.channelId, tableId: params.tableId, info: 'Unable to store player record in join - ' + JSON.stringify(err)});
//       }
//     });
//   }
//   cb(null, params);
// }

// generte response when player leave
// case > no game running on table
var generateResponse = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function generateResponse');
  params.data.success = true;
  params.data.response = {
    success         : true,
    channelId       : params.channelId,
    isGameOver      : false,
    isCurrentPlayer : false,
    isRoundOver     : false,
    playerLength    : params.table.players.length,
    isSeatsAvailable: params.table.maxPlayers !== params.table.players.length,
    broadcast       : {
      success     : true,
      channelId   : params.channelId,
      playerId    : params.data.playerId,
      playerName  : params.data.playerName,
      isStandup   : params.data.action === stateOfX.move.standup
    },
    turn : {},
    round: {},
    over : {},
    preChecks : []
  };

  cb(null, params);
};

// ### Handle all cases required to handle a leave
///*************
/// player who is observer
///// can try to leave room
///// may be forced to leave room by server
/// player who has occupied a seat
///// may be forced to vacant seat by server (when state was RESRVED)
///// may be forced to vacant seat by server (when state was ONBREAK)
///// can try to vacant seat and room at once
///// may be forced to vacant seat and room at once by server (in rare cases)
///************* SO LEAVE HAS MANY CASES
// > Params: {self, channelId, table, data {channelId, playerId, isStandup, isRequested}, table}
module.exports.leavePlayer = function(params, cb) {
  serverLog(stateOfX.serverLogType.info, 'in leaveRemote function leavePlayer');
  serverLog(stateOfX.serverLogType.info,'Players while leaving a player begins - ' + JSON.stringify(params.table.players));
/*console.trace("The Ninja's way of life is this");
console.error(params);*/
  keyValidator.validateKeySets("Request", params.serverType, "leavePlayer", params, function(validated){
    params = _.omit(params, 'self');
    if(validated.success) {
      if(params.table.channelType === stateOfX.gameType.normal) {
        if(params.table.state === stateOfX.gameState.running) {
           // var indexOfLeavingPlayer = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
//             console.error(indexOfLeavingPlayer,"  !!!!!!!!!!!!!!!!!!!!!!!!! ",params);
           // if(indexOfLeavingPlayer >=0  && params.table.players[indexOfLeavingPlayer].state == stateOfX.playerState.playing && params.table.players[indexOfLeavingPlayer].lastMove != stateOfX.move.fold){
             // cb({success: false, channelId: params.data.channelId, info: "You Cannot Leave as you are part of the game", isRetry: false, isDisplay: true});
           // }else{

            async.waterfall([

              async.apply(initializeParams, params),
              validateAction,
              isLeavePossible,
              refundAmountOnLeave,
              createAntiBankingEntry,
              updatePlayer,
              isCurrentPlayer,
              setfirstActiveIndex,
              adjustActiveIndexes,
              updateConfigIndexes,
              validateGameOver,
              onLeaveSummary,
              removeFromTable,
              removeActivity,   // remove activity fro in memory for disconnection handling
              removeSpectatorRecord,
              isRoundOver,
              setNextPlayer,
              adjustRoundBets,
              setMaxRaise,
              getMoves,
              adjustActiveIndexes,
              decidePlayerPrechecks,
              createLeaveResponse

            ], function(err, response){
              if(err) {
                if(!!err.data && err.data.success) {
                   console.error("i should  not be called from here");
                  // activity.leaveGame(err,stateOfX.profile.category.game,stateOfX.game.subCategory.leave,stateOfX.logType.success);
                  // activity.leaveGame(err,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.leave,stateOfX.logType.success);
                  cb({success: true, table: params.table, data: params.data});
                } else {
                  // activity.leaveGame(err,stateOfX.profile.category.game,stateOfX.game.subCategory.leave,stateOfX.logType.error);
                  // activity.leaveGame(err,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.leave,stateOfX.logType.error);
                  serverLog(stateOfX.serverLogType.error, '1. This should not be success response for LEAVE - ' + JSON.stringify(err));
                  cb(err);
                }
              } else {
                // activity.leaveGame(params,stateOfX.profile.category.game,stateOfX.game.subCategory.leave,stateOfX.logType.success);
                // activity.leaveGame(params,stateOfX.profile.category.gamePlay,stateOfX.gamePlay.subCategory.leave,stateOfX.logType.success);
                serverLog(stateOfX.serverLogType.info, 'Sending final leave broadcast on success case');
                cb({success: true, table: params.table, data: params.data});
              }
            });
          // }
        } else {
          //console.error(stateOfX.serverLogType.info,'Removing player when Game is - ' + params);
          var indexOfLeavingPlayer = _ld.findIndex(params.table.players, {playerId: params.data.playerId});
//           console.error(indexOfLeavingPlayer,"  !!!!!!!!!!!!!!!!!!!!!!!!! ",params);
           // if(!params.data.isRequested && !params.data.isStandup && indexOfLeavingPlayer >=0){
           //   cb({success: false, channelId: params.data.channelId, info: "You Cannot Leave as you are part of the game", isRetry: false, isDisplay: true});
           // }else{
              async.waterfall([

              async.apply(setLeaveParams, params),
              validateAction,
              createAntiBankingEntry,
              refundAmountOnLeave,
              onLeaveSummary,
              removeFromTable,
              removeActivity,   // remove activity fro in memory for disconnection handling
              removeSpectatorRecord,
              adjustActiveIndexes,
              generateResponse,

              ], function(err, response){
                serverLog(stateOfX.serverLogType.info, '====== FINAL LEAVE RESPONSE IDLE =======');
                serverLog(stateOfX.serverLogType.info, JSON.stringify(err));
                serverLog(stateOfX.serverLogType.info, JSON.stringify(response));
                if(err) {
                  serverLog(stateOfX.serverLogType.error, '2. This should not be success response for LEAVE - ' + JSON.stringify(err));
                  // activity.leaveGame(params,stateOfX.profile.category.game,stateOfX.game.subCategory.leave,stateOfX.logType.error);
                  cb(err);
                } else {
                  activity.leaveGame(params,stateOfX.profile.category.game,stateOfX.game.subCategory.leave,stateOfX.logType.success);
                  cb({success: true, table: params.table, data: params.data});
                }
              });
          // }
        }
      } else {
        serverLog(stateOfX.serverLogType.info,'Not removing player as this is Game type - ' + params.table.channelType);
        params.data.response = {success: true, channelId: params.channelId};
        // activity.leaveGame(params,stateOfX.profile.category.game,stateOfX.game.subCategory.leave,stateOfX.logType.success);

        tournamentLeave.processLeave(params, function(tournamentLeaveResponse){
          serverLog(stateOfX.serverLogType.info,'tournamentLeaveResponse');
          serverLog(stateOfX.serverLogType.info, JSON.stringify(tournamentLeaveResponse));
          cb(tournamentLeaveResponse);
        });
      }
    } else {
      cb(validated);
    }
  });
};
